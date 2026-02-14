'use client';

import { OptionPosition } from '@/types/options';
import { 
  exportPositionsCSV, importPositionsCSV, exportPositionsJSON, importPositionsJSON, 
  exportPositionsWithHistoryJSON, clearAllPositions,
  getClosedPositions, exportClosedPositionsCSV, exportClosedPositionsJSON, clearClosedPositions 
} from '@/lib/storage';
import { useState, useEffect } from 'react';

interface PortfolioSummaryProps {
  positions: OptionPosition[];
}

export default function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const [closedPositions, setClosedPositions] = useState<any[]>([]);
  const [showClosedHistory, setShowClosedHistory] = useState(false);

  useEffect(() => {
    setClosedPositions(getClosedPositions());
  }, []);
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

  const handleExportFullJSON = () => {
    const json = exportPositionsWithHistoryJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options-positions-full.json';
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
        alert(`Successfully imported positions from CSV`);
        window.location.reload();
      } else if (isJSON) {
        const result = importPositionsJSON(text);
        if (result.success) {
          const msg = `Successfully imported ${result.count} position${result.count !== 1 ? 's' : ''}`;
          if (result.errors.length > 0) {
            alert(`${msg}\n\nWarnings:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...and ' + (result.errors.length - 5) + ' more' : ''}`);
          } else {
            alert(msg);
          }
          window.location.reload();
        } else {
          alert(`Import failed:\n${result.errors.join('\n')}`);
        }
      } else {
        alert('Unsupported file type. Please upload .csv or .json');
        return;
      }
    } catch (e) {
      alert('Failed to import file: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const handleClearAll = () => {
    if (positions.length === 0) {
      alert('No positions to clear.');
      return;
    }
    const ok = window.confirm(`Are you sure you want to clear all ${positions.length} position${positions.length !== 1 ? 's' : ''}? This cannot be undone.`);
    if (!ok) return;
    clearAllPositions();
    alert('All positions have been cleared.');
    window.location.reload();
  };

  const handleExportClosedCSV = () => {
    if (closedPositions.length === 0) {
      alert('No closed positions to export.');
      return;
    }
    const csv = exportClosedPositionsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options-closed-positions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportClosedJSON = () => {
    if (closedPositions.length === 0) {
      alert('No closed positions to export.');
      return;
    }
    const json = exportClosedPositionsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options-closed-positions.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClearClosed = () => {
    if (closedPositions.length === 0) {
      alert('No closed positions to clear.');
      return;
    }
    const ok = window.confirm(`Are you sure you want to clear all ${closedPositions.length} closed position${closedPositions.length !== 1 ? 's' : ''}? This cannot be undone.`);
    if (!ok) return;
    clearClosedPositions();
    setClosedPositions([]);
    alert('All closed positions have been cleared.');
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-sm text-gray-600 font-medium">Data Backup & Restore</span>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleExportCSV} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            title="Export positions as CSV (no price history)"
          >
            Export CSV
          </button>
          <button 
            onClick={handleExportJSON} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            title="Export positions as JSON with price history"
          >
            Export JSON
          </button>
          <button 
            onClick={handleExportFullJSON} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            title="Export positions with full price history and stats"
          >
            Export Full Data
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
          <button 
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            title="Clear all positions from localStorage"
          >
            Clear All
          </button>
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

      {/* Closed Positions Section */}
      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm text-gray-600 font-medium">Closed Positions History</span>
            <span className="ml-2 text-sm text-gray-500">({closedPositions.length} recorded)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowClosedHistory(!showClosedHistory)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              {showClosedHistory ? 'Hide' : 'Show'} History
            </button>
            <button
              onClick={handleExportClosedCSV}
              disabled={closedPositions.length === 0}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportClosedJSON}
              disabled={closedPositions.length === 0}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Export JSON
            </button>
            <button
              onClick={handleClearClosed}
              disabled={closedPositions.length === 0}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Clear History
            </button>
          </div>
        </div>

        {showClosedHistory && closedPositions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Ticker</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Strike</th>
                  <th className="px-3 py-2 text-left">Expiry</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Entry $</th>
                  <th className="px-3 py-2 text-right">Close $</th>
                  <th className="px-3 py-2 text-right">Realized P&L</th>
                  <th className="px-3 py-2 text-left">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => (
                  <tr key={pos.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{pos.ticker}</td>
                    <td className="px-3 py-2">{pos.optionType}</td>
                    <td className="px-3 py-2 text-right">{pos.strike}</td>
                    <td className="px-3 py-2">{pos.expiry}</td>
                    <td className="px-3 py-2 text-right">{pos.quantity}</td>
                    <td className="px-3 py-2 text-right">{pos.entryPrice?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{pos.closePrice?.toFixed(2) || '-'}</td>
                    <td className={`px-3 py-2 text-right font-medium ${pos.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pos.realizedPnl >= 0 ? '+' : ''}{formatCurrency(pos.realizedPnl)}
                    </td>
                    <td className="px-3 py-2">{pos.closeDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showClosedHistory && closedPositions.length === 0 && (
          <p className="text-sm text-gray-500 italic">No closed positions recorded yet. Import a statement with closed/assigned trades to populate this history.</p>
        )}
      </div>
    </>
  );
}
