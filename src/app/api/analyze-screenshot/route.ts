import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedPosition {
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  broker?: string;
  confidence: 'high' | 'medium' | 'low';
  calculationMethod?: 'extracted' | 'calculated';
  rawText?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      }, { status: 500 });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a financial data extraction assistant. Extract option positions from brokerage screenshots.

Extract ALL option positions visible in the image. For each position, identify:
- ticker: Stock symbol (e.g., NVDA, AAPL)
- optionType: "call" or "put" 
- side: "buy" (long) or "sell" (short/credit). If you see "-" (negative) quantity or terms like "credit", "sold", "short" → side is "sell". Otherwise "buy".
- strike: Strike price as number (e.g., 145, 140.50)
- expiry: Expiration date in YYYY-MM-DD format. Convert any date format (e.g., "Feb 21 2025" → "2025-02-21", "2/21/25" → "2025-02-21")
- quantity: Number of contracts as positive integer
- entryPrice: Entry price per contract (CRITICAL - see below for calculation)
- broker: Broker name if visible in UI (Schwab, Fidelity, TD, Robinhood, etc.)
- confidence: "high" if clearly readable, "medium" if somewhat unclear, "low" if uncertain

ENTRY PRICE CALCULATION (IMPORTANT):
If the screenshot shows "entry price" or "cost basis" or "average entry" → use that value directly.

If entry price is NOT shown but you see:
- Current/market price (e.g., $2.50, Mark $2.50, Last $2.50)
- Percentage change or P&L % (e.g., "+25%", "-15%", "▼ 20%")

Then CALCULATE entryPrice using: entryPrice = currentPrice / (1 + percentChange/100)

Examples:
- Current $2.50, Change +25% → entryPrice = 2.50 / 1.25 = $2.00
- Current $3.00, Change -10% → entryPrice = 3.00 / 0.90 = $3.33
- Current $1.80, Change +50% → entryPrice = 1.80 / 1.50 = $1.20

Set calculationMethod to "calculated" if you computed it, or "extracted" if directly read from image.

Return ONLY a JSON object in this exact format:
{
  "positions": [
    {
      "ticker": "NVDA",
      "optionType": "put",
      "side": "sell",
      "strike": 145,
      "expiry": "2025-02-21",
      "quantity": 2,
      "entryPrice": 0.67,
      "calculationMethod": "extracted",
      "broker": "Schwab",
      "confidence": "high"
    }
  ],
  "totalPositions": 1,
  "brokerDetected": "Schwab"
}

If no positions found, return: {"positions": [], "totalPositions": 0, "brokerDetected": null}

Be precise with dates - use the year shown or infer from context (if Feb 21 and no year shown, assume current year or next year if date passed).`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for consistent formatting
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Extract JSON from response (handle cases where AI might wrap in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ 
        error: 'Could not parse AI response',
        rawResponse: content 
      }, { status: 500 });
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    
    // Validate the response structure
    if (!Array.isArray(parsedData.positions)) {
      return NextResponse.json({ 
        error: 'Invalid response format from AI',
        rawResponse: content 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      positions: parsedData.positions,
      totalPositions: parsedData.totalPositions || parsedData.positions.length,
      brokerDetected: parsedData.brokerDetected,
    });

  } catch (error) {
    console.error('Screenshot analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze screenshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
