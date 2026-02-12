export interface PriceSnapshot {
  timestamp: number;
  price: number;
  underlyingPrice?: number;
}

export interface OptionPosition {
  id: string;
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell'; // buy = long/debit, sell = short/credit
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  entryDate: string;
  notes?: string;
  broker?: string;
  lastPriceUpdate?: number; // timestamp of last price fetch
  priceHistory?: PriceSnapshot[]; // Historical price snapshots
}
