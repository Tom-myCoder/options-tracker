'use client';

import { OptionPosition } from '@/types/options';
import { deletePosition } from '@/lib/storage';

interface PositionsTableProps {
  positions: OptionPosition[];
  onDelete: () => void;
}

export default function PositionsTable({ positions, onDelete }: PositionsTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const calculateDaysToExpiry = (expiry: string) => {
    const expiryDate = new Date(expiry);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this position?')) {
      deletePosition(id);
      onDelete();
    }
  };

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-500">No positions yet. Add your first option above!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Strike
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expiry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DTE
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invested
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {positions.map((position) => {
              const invested = position.entryPrice * position.quantity * 100;
              const dte = calculateDaysToExpiry(position.expiry);
              
              return (
                <tr key={position.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                    {position.ticker}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      position.optionType === 'call' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {position.optionType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {formatCurrency(position.strike)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {new Date(position.expiry).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`text-sm ${
                      dte < 7 ? 'text-red-600 font-semibold' : 
                      dte < 30 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {dte}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {position.quantity}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {formatCurrency(position.entryPrice)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {formatCurrency(invested)}
                  </td>
                  <td className="px-4 py-4 text-gray-600 max-w-xs truncate">
                    {position.notes || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(position.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
