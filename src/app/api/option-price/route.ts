import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const expiry = searchParams.get('expiry'); // YYYY-MM-DD
  const strike = searchParams.get('strike');
  const optionType = searchParams.get('type'); // 'call' or 'put'
  
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  try {
    console.log(`[API] Request: ${ticker} ${optionType} $${strike} ${expiry}`);
    
    // If we have all option details, try to find specific option price
    if (expiry && strike && optionType) {
      const optionPrice = await fetchOptionPrice(
        ticker.toUpperCase(),
        expiry,
        parseFloat(strike),
        optionType as 'call' | 'put'
      );
      
      console.log(`[API] Result: ${optionPrice !== null ? `price=${optionPrice}` : 'not found'}`);
      
      if (optionPrice !== null) {
        return NextResponse.json({
          symbol: ticker.toUpperCase(),
          optionPrice,
          expiry,
          strike: parseFloat(strike),
          type: optionType,
          timestamp: Date.now(),
        });
      }
    }
    
    // Fallback: fetch underlying stock price
    const quote = await yahooFinance.quote(ticker.toUpperCase()) as {
      symbol: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
    };
    
    return NextResponse.json({
      symbol: quote.symbol,
      price: quote.regularMarketPrice ?? null,
      change: quote.regularMarketChange ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
      timestamp: Date.now(),
      note: 'Option price not found, returning underlying price',
    });
  } catch (error) {
    console.error('Yahoo Finance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    );
  }
}

async function fetchOptionPrice(
  ticker: string,
  expiry: string,
  strike: number,
  type: 'call' | 'put'
): Promise<number | null> {
  try {
    console.log(`[Yahoo] Fetching ${type} option for ${ticker} @ $${strike} exp ${expiry}`);
    
    // Try fetching option chain first (more reliable)
    const chain = await yahooFinance.options(ticker, {
      date: new Date(expiry),
    }) as unknown as {
      options?: {
        calls: Array<{ strike: number; lastPrice?: number; bid?: number; ask?: number }>;
        puts: Array<{ strike: number; lastPrice?: number; bid?: number; ask?: number }>;
      };
    };
    
    console.log(`[Yahoo] Chain result:`, chain ? 'found' : 'not found', 'options:', chain?.options ? 'yes' : 'no');
    
    if (chain && chain.options) {
      const optionsList = type === 'call' ? chain.options.calls : chain.options.puts;
      console.log(`[Yahoo] ${type} options count:`, optionsList?.length || 0);
      
      if (Array.isArray(optionsList) && optionsList.length > 0) {
        // Log first few strikes to debug
        console.log(`[Yahoo] Available strikes:`, optionsList.slice(0, 5).map(o => o.strike));
        
        const matchingOption = optionsList.find(
          (opt) => opt && typeof opt.strike === 'number' && Math.abs(opt.strike - strike) < 0.01
        );
        
        console.log(`[Yahoo] Matching option:`, matchingOption ? `strike=${matchingOption.strike}, lastPrice=${matchingOption.lastPrice}` : 'not found');
        
        if (matchingOption) {
          // Use lastPrice, or fallback to bid/ask midpoint
          const price = matchingOption.lastPrice || 
            (matchingOption.bid && matchingOption.ask ? (matchingOption.bid + matchingOption.ask) / 2 : undefined);
          
          if (price && price > 0) {
            console.log(`[Yahoo] Returning price: ${price}`);
            return price;
          }
        }
      }
    }
    
    // Fallback: Try direct option symbol quote
    const [year, month, day] = expiry.split('-');
    const optionTypeCode = type === 'call' ? 'C' : 'P';
    const shortYear = year.slice(2);
    const strikeFormatted = Math.round(strike * 1000).toString().padStart(8, '0');
    const optionSymbol = `${ticker}${shortYear}${month}${day}${optionTypeCode}${strikeFormatted}`;
    
    console.log(`[Yahoo] Trying option symbol: ${optionSymbol}`);
    
    try {
      const quote = await yahooFinance.quote(optionSymbol) as {
        regularMarketPrice?: number;
      };
      console.log(`[Yahoo] Symbol quote result:`, quote);
      if (quote && quote.regularMarketPrice && quote.regularMarketPrice > 0) {
        return quote.regularMarketPrice;
      }
    } catch (e) {
      console.log(`[Yahoo] Symbol quote failed:`, e);
    }
    
    console.log(`[Yahoo] No price found for ${ticker} ${type} $${strike} ${expiry}`);
    return null;
  } catch (error) {
    console.error('[Yahoo] Error fetching option price:', error);
    return null;
  }
}
