export interface OptionPosition {
  id: string;
  ticker: string;
  optionType: 'call' | 'put';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  entryDate: string;
  notes?: string;
}

export interface PortfolioSummary {
  totalPositions: number;
  totalInvested: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}
