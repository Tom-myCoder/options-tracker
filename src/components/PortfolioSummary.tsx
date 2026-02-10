'use client';

import { OptionPosition } from '@/types/options';

interface PortfolioSummaryProps {
  positions: OptionPosition[];
}

export default function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const calculateSummary = () => {
    const totalPositions = positions.length;
    const buyPositions = positions.filter(p => p.side === 'buy');
    const sellPositions = positions.filter(p => p.side === 'sell');
    
    // Total debits (money paid for buys)
    const totalDebits = buyPositions.reduce((sum, p) => sum + (p.entryPrice * p.quantity * 100), 0);
    
    // Total credits (money received from sells)
    const totalCredits = sellPositions.reduce((sum, p) => sum + (p.entryPrice * p.quantity * 100), 0);
    
    // Net cash flow (credits - debits)
    // Positive = net credit received, Negative = net debit paid
    const netCashFlow = totalCredits - totalDebits;
    
    // Total exposure (sum of strike × quantity × 100 for all positions)
    // This represents the notional value at risk
    const totalExposure = positions.reduce((sum, p) => sum + (p.strike * p.quantity * 100), 0);
    
    // For MVP, P&L is 0 until we add live prices
    const totalPnL = 0;

    return {
      totalPositions,
      totalDebits,
      totalCredits,
      netCashFlow,
      totalExposure,
      totalPnL,
    };
  };

  const summary = calculateSummary();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Positions</p>
        <p className="text-2xl font-bold text-gray-900">{summary.totalPositions}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Debits (Buys)</p>
        <p className="text-2xl font-bold text-red-600">-{formatCurrency(summary.totalDebits)}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Credits (Sells)</p>
        <p className="text-2xl font-bold text-green-600">+{formatCurrency(summary.totalCredits)}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Net Cash Flow</p>
        <p className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {summary.netCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.netCashFlow)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {summary.netCashFlow >= 0 ? 'Net Credit' : 'Net Debit'}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Exposure</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalExposure)}</p>
      </div>
    </div>
  );
}
