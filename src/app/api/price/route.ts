import { NextRequest, NextResponse } from 'next/server';
import { yahooFinance } from 'yahoo-finance2';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  try {
    // Fetch quote for the underlying stock
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
    });
  } catch (error) {
    console.error('Yahoo Finance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    );
  }
}
