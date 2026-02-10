'use client';

import { OptionPosition, PortfolioSummary } from '@/types/options';

interface PortfolioSummaryProps {
  positions: OptionPosition[];
}

export default function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const calculateSummary = (): PortfolioSummary => {
    const totalPositions = positions.length;
    const totalInvested = positions.reduce((sum, p) => sum + (p.entryPrice * p.quantity * 100), 0);
    
    // For MVP, assume current price = entry price (no live pricing yet)
    // TODO: Add live price fetching
    const currentValue = totalInvested;
    const totalPnL = currentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalPositions,
      totalInvested,
      currentValue,
      totalPnL,
      totalPnLPercent,
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Positions</p>
        <p className="text-2xl font-bold text-gray-900">{summary.totalPositions}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total Invested</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalInvested)}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Current Value</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.currentValue)}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-600 mb-1">Total P&L</p>
        <p className={`text-2xl font-bold ${summary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {summary.totalPnL >= 0 ? '+' : ''}{formatCurrency(summary.totalPnL)}
        </p>
      </div>
    </div>
  );
}
