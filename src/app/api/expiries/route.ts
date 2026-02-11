import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  try {
    const result = await yahooFinance.options(ticker.toUpperCase());

    // Try common properties
    let expiries: number[] = [];
    if (result && Array.isArray((result as any).expirationDates)) {
      expiries = (result as any).expirationDates as number[];
    } else if (result && Array.isArray((result as any).expirations)) {
      expiries = (result as any).expirations as number[];
    }

    // Convert unix seconds to ISO date strings (YYYY-MM-DD)
    const dates = expiries
      .map(ts => {
        try {
          const n = typeof ts === 'number' ? ts : Number(ts);
          if (isNaN(n)) return null;
          const d = new Date(n * 1000);
          return d.toISOString().split('T')[0];
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean) as string[];

    // Deduplicate + sort
    const unique = Array.from(new Set(dates)).sort();

    return NextResponse.json({ expiries: unique });
  } catch (error) {
    console.error('Error fetching expiries:', error);
    return NextResponse.json({ error: 'Failed to fetch expiries' }, { status: 500 });
  }
}
