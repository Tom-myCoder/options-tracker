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
    broker: '',
    notes: '',
  });

  const [formKey, setFormKey] = useState(0); // used to remount the form to avoid stubborn browser autofill

  // Generate unique field names that change with each form remount to defeat browser autofill
  const fieldName = (base: string) => `${base}_${formKey}`;

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
      // currentPrice will be populated later from market data (Yahoo) — leave undefined for now
      entryDate: new Date().toISOString().split('T')[0],
      notes: formData.notes,
      broker: formData.broker?.trim() || undefined,
    };

    // Save first
    savePosition(position);

    // Reset form immediately so fields clear and remount the form to avoid autofill
    setFormData({
      ticker: '',
      optionType: 'call',
      side: 'buy',
      strike: '',
      expiry: '',
      quantity: '',
      entryPrice: '',
      broker: '',
      notes: '',
    });

    // Remount form (keeps browser autofill from re-populating old values)
    setFormKey(k => k + 1);

    // Notify parent to refresh
    onAdd();
  };

  return (
    <form key={formKey} onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6" autoComplete="off">
      <h2 className="text-xl font-bold text-black mb-4">Add New Position</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Ticker Symbol
          </label>
          <input
            type="text"
            required
            name={fieldName('ticker')}
            placeholder="NVDA"
            autoComplete="new-password"
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Option Type
          </label>
          <select
            name={fieldName('optionType')}
            value={formData.optionType}
            autoComplete="off"
            onChange={(e) => setFormData({ ...formData, optionType: e.target.value as 'call' | 'put' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Side
          </label>
          <select
            name={fieldName('side')}
            value={formData.side}
            autoComplete="off"
            onChange={(e) => setFormData({ ...formData, side: e.target.value as 'buy' | 'sell' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          >
            <option value="buy">Buy (Long/Debit)</option>
            <option value="sell">Sell (Short/Credit)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Strike Price ($)
          </label>
          <input
            type="number"
            step="0.01"
            required
            name={fieldName('strike')}
            placeholder="120.00"
            autoComplete="new-password"
            value={formData.strike}
            onChange={(e) => setFormData({ ...formData, strike: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Expiry Date
          </label>
          <input
            type="date"
            required
            name={fieldName('expiry')}
            autoComplete="off"
            value={formData.expiry}
            onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Quantity (Contracts)
          </label>
          <input
            type="number"
            required
            name={fieldName('quantity')}
            placeholder="1"
            autoComplete="new-password"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Entry Price per Contract ($)
          </label>
          <input
            type="number"
            step="0.01"
            required
            name={fieldName('entryPrice')}
            placeholder="5.00"
            autoComplete="new-password"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Broker (optional)
          </label>
          <input
            type="text"
            name={fieldName('broker')}
            placeholder="e.g., TD, Robinhood"
            autoComplete="new-password"
            value={formData.broker}
            onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-bold text-black mb-1">
          Notes (optional)
        </label>
        <textarea
          name={fieldName('notes')}
          placeholder="Strategy, thesis, stop loss, etc."
          autoComplete="new-password"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
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
