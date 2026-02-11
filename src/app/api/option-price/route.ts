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
    // If we have all option details, try to find specific option price
    if (expiry && strike && optionType) {
      const optionPrice = await fetchOptionPrice(
        ticker.toUpperCase(),
        expiry,
        parseFloat(strike),
        optionType as 'call' | 'put'
      );
      
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
    // Convert expiry to Yahoo format (YYYYMMDD)
    const [year, month, day] = expiry.split('-');
    const yahooExpiry = `${year}-${month}-${day}`;
    
    // Yahoo uses 'C' for call and 'P' for put in option symbols
    const optionTypeCode = type === 'call' ? 'C' : 'P';
    
    // Construct option symbol: TICKER+YYMMDD+TYPE+STRIKE
    // Example: NVDA250214C00150000 (NVDA Feb 14 2025 Call $150)
    const shortYear = year.slice(2);
    const strikeFormatted = Math.round(strike * 1000).toString().padStart(8, '0');
    const optionSymbol = `${ticker}${shortYear}${month}${day}${optionTypeCode}${strikeFormatted}`;
    
    try {
      const quote = await yahooFinance.quote(optionSymbol) as {
        regularMarketPrice?: number;
      };
      if (quote && quote.regularMarketPrice) {
        return quote.regularMarketPrice;
      }
    } catch {
      // Option symbol format might be different, try alternative
    }
    
    // Try fetching option chain
    const chain = await yahooFinance.options(ticker, {
      date: new Date(expiry),
    }) as {
      options?: {
        calls: Array<{ strike: number; lastPrice?: number }>;
        puts: Array<{ strike: number; lastPrice?: number }>;
      };
    };
    
    if (chain && chain.options) {
      const optionsList = type === 'call' ? chain.options.calls : chain.options.puts;
      if (Array.isArray(optionsList)) {
        const matchingOption = optionsList.find(
          (opt) => opt && typeof opt.strike === 'number' && Math.abs(opt.strike - strike) < 0.01
        );
        
        if (matchingOption && matchingOption.lastPrice) {
          return matchingOption.lastPrice;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching option price:', error);
    return null;
  }
}
