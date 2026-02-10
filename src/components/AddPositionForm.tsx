'use client';

import { useState } from 'react';
import { OptionPosition } from '@/types/options';
import { savePosition, generateId } from '@/lib/storage';

interface AddPositionFormProps {
  onAdd: () => void;
}

export default function AddPositionForm({ onAdd }: AddPositionFormProps) {
  const [formData, setFormData] = useState({
    ticker: '',
    optionType: 'call' as 'call' | 'put',
    side: 'buy' as 'buy' | 'sell',
    strike: '',
    expiry: '',
    quantity: '',
    entryPrice: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const position: OptionPosition = {
      id: generateId(),
      ticker: formData.ticker.toUpperCase(),
      optionType: formData.optionType,
      side: formData.side,
      strike: parseFloat(formData.strike),
      expiry: formData.expiry,
      quantity: parseInt(formData.quantity),
      entryPrice: parseFloat(formData.entryPrice),
      entryDate: new Date().toISOString().split('T')[0],
      notes: formData.notes,
    };

    savePosition(position);
    onAdd();
    
    // Reset form
    setFormData({
      ticker: '',
      optionType: 'call',
      side: 'buy',
      strike: '',
      expiry: '',
      quantity: '',
      entryPrice: '',
      notes: '',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Add New Position</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Ticker Symbol
          </label>
          <input
            type="text"
            required
            placeholder="NVDA"
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Option Type
          </label>
          <select
            value={formData.optionType}
            onChange={(e) => setFormData({ ...formData, optionType: e.target.value as 'call' | 'put' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Side
          </label>
          <select
            value={formData.side}
            onChange={(e) => setFormData({ ...formData, side: e.target.value as 'buy' | 'sell' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="buy">Buy (Long/Debit)</option>
            <option value="sell">Sell (Short/Credit)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Strike Price ($)
          </label>
          <input
            type="number"
            step="0.01"
            required
            placeholder="120.00"
            value={formData.strike}
            onChange={(e) => setFormData({ ...formData, strike: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Expiry Date
          </label>
          <input
            type="date"
            required
            value={formData.expiry}
            onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Quantity (Contracts)
          </label>
          <input
            type="number"
            required
            placeholder="1"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Entry Price per Contract ($)
          </label>
          <input
            type="number"
            step="0.01"
            required
            placeholder="5.00"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Notes (optional)
        </label>
        <textarea
          placeholder="Strategy, thesis, stop loss, etc."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
        />
      </div>

      <button
        type="submit"
        className="mt-4 w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Add Position
      </button>
    </form>
  );
}
