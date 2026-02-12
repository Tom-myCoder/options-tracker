'use client';

import { OptionPosition } from '@/types/options';
import { exportPositionsCSV, importPositionsCSV, exportPositionsJSON, importPositionsJSON } from '@/lib/storage';

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
    
    // Total exposure only for Sell Put positions (obligation to buy stock at strike if assigned)
    // For Buy Put, Sell Call, Buy Call - exposure is just the premium paid (not calculated here)
    const sellPutPositions = positions.filter(p => p.side === 'sell' && p.optionType === 'put');
    const totalExposure = sellPutPositions.reduce((sum, p) => sum + (p.strike * p.quantity * 100), 0);
    
    // For MVP, P&L is 0 until we add live prices
    const totalPnL = 0;

    // Brokers summary (unique non-empty brokers and counts)
    const brokerCounts: Record<string, number> = {};
    positions.forEach(p => {
      if (p.broker && p.broker.trim() !== '') {
        const key = p.broker.trim();
        brokerCounts[key] = (brokerCounts[key] || 0) + 1;
      }
    });

    return {
      totalPositions,
      totalDebits,
      totalCredits,
      netCashFlow,
      totalExposure,
      totalPnL,
      brokerCounts,
    };
  };

  const summary = calculateSummary();

  const brokerList = summary.brokerCounts && Object.keys(summary.brokerCounts).length > 0
    ? Object.entries(summary.brokerCounts).map(([b,c]) => `${b} (${c})`).join(', ')
    : '-';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleExportCSV = () => {
    const csv = exportPositionsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options-positions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = exportPositionsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options-positions.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isJSON = file.name.toLowerCase().endsWith('.json');

    const ok = window.confirm('This will replace your current positions in localStorage. Continue?');
    if (!ok) return;

    try {
      if (isCSV) {
        importPositionsCSV(text);
      } else if (isJSON) {
        importPositionsJSON(text);
      } else {
        alert('Unsupported file type. Please upload .csv or .json');
        return;
      }
      // Refresh the page so UI picks up new positions (simple and reliable for now)
      window.location.reload();
    } catch (e) {
      alert('Failed to import file');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-sm text-gray-600 font-medium">Data Backup & Restore</span>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleExportCSV} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Export CSV
          </button>
          <button 
            onClick={handleExportJSON} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Export JSON
          </button>
          <label className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium cursor-pointer hover:bg-green-700 transition-colors">
            Import File
            <input 
              type="file" 
              accept=".csv,.json" 
              onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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

        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600 mb-1">Brokers</p>
          <p className="text-sm font-medium text-gray-900">{brokerList}</p>
        </div>
      </div>
    </>
  );
}
