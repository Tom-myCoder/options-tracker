export interface PriceSnapshot {
  timestamp: number;
  price: number;
  underlyingPrice?: number;
}

// Data format version for migration support
export const DATA_VERSION = 1;

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
  entryDate: string; // System tracking date
  purchaseDate?: string; // Optional user-specified purchase date
  notes?: string;
  broker?: string;
  lastPriceUpdate?: number; // timestamp of last price fetch
  priceHistory?: PriceSnapshot[]; // Historical price snapshots
  dataVersion?: number; // Version for backward compatibility
}
