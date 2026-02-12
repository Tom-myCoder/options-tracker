import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const expiry = searchParams.get('expiry');
  const strike = searchParams.get('strike');
  const optionType = searchParams.get('type');
  const from = searchParams.get('from'); // Purchase date
  const to = searchParams.get('to'); // Optional end date (defaults to now)
  
  if (!ticker || !expiry || !strike || !optionType || !from) {
    return NextResponse.json({ 
      error: 'Missing required params: ticker, expiry, strike, type, from' 
    }, { status: 400 });
  }

  try {
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : new Date();
    
    // Validate dates
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
    }
    
    const historicalPrices: Array<{
      date: string;
      price: number;
      underlyingPrice?: number;
    }> = [];
    
    // Get current option price first
    let currentPrice: number | undefined;
    let currentUnderlying: number | undefined;
    
    try {
      const chain = await yahooFinance.options(ticker.toUpperCase(), {
        date: new Date(expiry),
      }) as unknown as {
        options?: {
          calls: Array<{ strike: number; lastPrice?: number; bid?: number; ask?: number }>;
          puts: Array<{ strike: number; lastPrice?: number; bid?: number; ask?: number }>;
        };
        quote?: {
          regularMarketPrice?: number;
        };
      };
      
      if (chain && chain.options) {
        const optionsList = optionType === 'call' 
          ? chain.options.calls 
          : chain.options.puts;
        
        const strikeNum = parseFloat(strike);
        const matchingOption = optionsList.find(
          (opt) => opt && typeof opt.strike === 'number' && Math.abs(opt.strike - strikeNum) < 0.01
        );
        
        if (matchingOption) {
          currentPrice = matchingOption.lastPrice || 
            (matchingOption.bid && matchingOption.ask 
              ? (matchingOption.bid + matchingOption.ask) / 2 
              : undefined);
          currentUnderlying = chain.quote?.regularMarketPrice;
          
          if (currentPrice) {
            historicalPrices.push({
              date: new Date().toISOString().split('T')[0],
              price: currentPrice,
              underlyingPrice: currentUnderlying,
            });
          }
        }
      }
    } catch (chainError) {
      console.error('Error fetching option chain:', chainError);
    }
    
    // Fetch underlying stock historical prices
    const daysBack = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysBack > 0 && daysBack <= 365) {
      try {
        // Use chart() method which is more reliable for historical data
        const chartResult = await yahooFinance.chart(ticker.toUpperCase(), {
          period1: Math.floor(fromDate.getTime() / 1000), // Unix timestamp
          period2: Math.floor(toDate.getTime() / 1000),
          interval: '1d',
        }) as unknown as {
          quotes?: Array<{
            date: Date;
            close: number;
          }>;
        };
        
        if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
          const strikeNum = parseFloat(strike);
          const daysToExpiry = Math.ceil((new Date(expiry).getTime() - toDate.getTime()) / (1000 * 60 * 60 * 24));
          
          for (const day of chartResult.quotes) {
            if (!day.close) continue;
            
            const estimatedOptionPrice = estimateOptionPrice({
              underlyingPrice: day.close,
              strike: strikeNum,
              daysToExpiry: Math.max(1, daysToExpiry + Math.ceil((toDate.getTime() - new Date(day.date).getTime()) / (1000 * 60 * 60 * 24))),
              optionType: optionType as 'call' | 'put',
              currentPrice: currentPrice || day.close * 0.1, // fallback estimate
              currentUnderlying: currentUnderlying || day.close,
            });
            
            historicalPrices.push({
              date: new Date(day.date).toISOString().split('T')[0],
              price: estimatedOptionPrice,
              underlyingPrice: day.close,
            });
          }
          
          // Sort by date ascending
          historicalPrices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
      } catch (chartError) {
        console.error('Error fetching historical chart data:', chartError);
        // Return what we have (at least current price)
      }
    }
    
    if (historicalPrices.length === 0) {
      return NextResponse.json({ 
        error: 'No price data available. The ticker may not have historical data available.' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      optionType,
      strike: parseFloat(strike),
      expiry,
      from,
      to: to || new Date().toISOString().split('T')[0],
      prices: historicalPrices,
      count: historicalPrices.length,
      note: 'Historical option prices are estimated from underlying stock prices using current option Greeks',
    });
    
  } catch (error) {
    console.error('Yahoo Finance historical error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical prices. Please try again later.' },
      { status: 500 }
    );
  }
}

// Simplified option price estimation using Black-Scholes-inspired approximation
function estimateOptionPrice(params: {
  underlyingPrice: number;
  strike: number;
  daysToExpiry: number;
  optionType: 'call' | 'put';
  currentPrice: number;
  currentUnderlying: number;
}): number {
  const { underlyingPrice, strike, daysToExpiry, optionType, currentPrice, currentUnderlying } = params;
  
  // Calculate intrinsic value
  let intrinsicValue = 0;
  if (optionType === 'call') {
    intrinsicValue = Math.max(0, underlyingPrice - strike);
  } else {
    intrinsicValue = Math.max(0, strike - underlyingPrice);
  }
  
  // Calculate current intrinsic for reference
  let currentIntrinsic = 0;
  if (optionType === 'call') {
    currentIntrinsic = Math.max(0, currentUnderlying - strike);
  } else {
    currentIntrinsic = Math.max(0, strike - currentUnderlying);
  }
  
  // Time value component
  const currentTimeValue = Math.max(0.01, currentPrice - currentIntrinsic);
  
  // Adjust time value based on days to expiry (square root rule for time decay)
  const timeRatio = Math.sqrt(Math.max(1, daysToExpiry) / 30);
  const adjustedTimeValue = currentTimeValue * timeRatio;
  
  // Delta approximation for price movement
  const underlyingDiff = underlyingPrice - currentUnderlying;
  let delta = 0.5;
  
  if (optionType === 'call') {
    // Calls: delta increases as we go ITM
    const moneyness = (underlyingPrice - strike) / strike;
    delta = 0.5 + Math.max(-0.4, Math.min(0.4, moneyness));
  } else {
    // Puts: delta becomes more negative as we go ITM
    const moneyness = (strike - underlyingPrice) / strike;
    delta = -0.5 - Math.max(-0.4, Math.min(0.4, moneyness));
  }
  
  // Combine components
  const estimatedPrice = Math.max(0.01, intrinsicValue + adjustedTimeValue + underlyingDiff * delta * 0.3);
  
  return Math.round(estimatedPrice * 100) / 100;
}
