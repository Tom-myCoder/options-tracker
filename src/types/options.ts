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
}
