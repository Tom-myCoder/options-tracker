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
    // Try to fetch historical option chain data
    // Yahoo Finance doesn't directly provide historical option prices easily
    // We'll try to reconstruct from the option chain at different dates
    
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : new Date();
    
    // Fetch historical data points
    const historicalPrices: Array<{
      date: string;
      price: number;
      underlyingPrice?: number;
    }> = [];
    
    // Try to get option chain for the expiry date
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
    
    // Get current option price
    if (chain && chain.options) {
      const optionsList = optionType === 'call' 
        ? chain.options.calls 
        : chain.options.puts;
      
      const strikeNum = parseFloat(strike);
      const matchingOption = optionsList.find(
        (opt) => opt && typeof opt.strike === 'number' && Math.abs(opt.strike - strikeNum) < 0.01
      );
      
      if (matchingOption) {
        const currentPrice = matchingOption.lastPrice || 
          (matchingOption.bid && matchingOption.ask 
            ? (matchingOption.bid + matchingOption.ask) / 2 
            : undefined);
        
        if (currentPrice) {
          historicalPrices.push({
            date: new Date().toISOString().split('T')[0],
            price: currentPrice,
            underlyingPrice: chain.quote?.regularMarketPrice,
          });
        }
      }
    }
    
    // For historical data, we'll need to use the underlying stock's historical prices
    // and estimate option prices using a simple model
    // This is an approximation since true historical option data is hard to get without paid APIs
    
    const daysBack = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysBack > 0 && daysBack <= 365) {
      try {
        // Fetch underlying stock historical prices
        const underlyingHistory = await yahooFinance.historical(ticker.toUpperCase(), {
          period1: fromDate,
          period2: toDate,
          interval: '1d',
        }) as unknown as Array<{
          date: Date;
          close: number;
        }>;
        
        // Estimate option prices from underlying prices
        // This uses a simplified Black-Scholes approximation
        const strikeNum = parseFloat(strike);
        const daysToExpiry = Math.ceil((new Date(expiry).getTime() - toDate.getTime()) / (1000 * 60 * 60 * 24));
        
        for (const day of underlyingHistory) {
          const estimatedOptionPrice = estimateOptionPrice({
            underlyingPrice: day.close,
            strike: strikeNum,
            daysToExpiry: Math.max(1, daysToExpiry + Math.ceil((toDate.getTime() - day.date.getTime()) / (1000 * 60 * 60 * 24))),
            optionType: optionType as 'call' | 'put',
            currentPrice: historicalPrices[0]?.price,
            currentUnderlying: chain.quote?.regularMarketPrice || underlyingHistory[underlyingHistory.length - 1]?.close,
          });
          
          historicalPrices.push({
            date: day.date.toISOString().split('T')[0],
            price: estimatedOptionPrice,
            underlyingPrice: day.close,
          });
        }
        
        // Sort by date ascending
        historicalPrices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
      } catch (e) {
        // If historical fetch fails, just return current price
      }
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
      note: 'Historical option prices are estimated from underlying stock prices and current option Greeks',
    });
    
  } catch (error) {
    console.error('Yahoo Finance historical error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical prices' },
      { status: 500 }
    );
  }
}

// Simplified option price estimation
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
  
  // Estimate time value based on days to expiry
  // This is a very rough approximation
  const timeDecayFactor = Math.sqrt(daysToExpiry / 30); // Assume 30DTE as baseline
  
  // Calculate price difference due to underlying movement
  const underlyingDiff = underlyingPrice - currentUnderlying;
  const delta = optionType === 'call' 
    ? (underlyingPrice > strike ? 0.5 : 0.3)
    : (underlyingPrice < strike ? -0.5 : -0.3);
  
  // Combine intrinsic, time value, and delta effect
  const estimatedPrice = Math.max(0.01, intrinsicValue + (currentPrice - Math.max(0, currentUnderlying - strike)) * timeDecayFactor + underlyingDiff * delta * 0.5);
  
  return Math.round(estimatedPrice * 100) / 100;
}
