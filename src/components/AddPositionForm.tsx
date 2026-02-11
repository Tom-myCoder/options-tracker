'use client';

import { useState, useRef, useCallback } from 'react';
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

  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Generate unique field names that change with each form remount
  const fieldName = useCallback((base: string) => `${base}_${formKey}`, [formKey]);

  const clearAllInputs = () => {
    // Force clear DOM elements directly to defeat browser autofill
    if (formRef.current) {
      const inputs = formRef.current.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => {
        const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (el.tagName === 'SELECT') {
          (el as HTMLSelectElement).selectedIndex = 0;
        } else {
          (el as HTMLInputElement | HTMLTextAreaElement).value = '';
        }
      });
    }
  };

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
      broker: formData.broker?.trim() || undefined,
    };

    // Save position
    savePosition(position);

    // Notify parent to refresh (do this before clearing so UI updates)
    onAdd();

    // Clear form state
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

    // Force clear DOM elements
    clearAllInputs();

    // Remount form with new key (after a short delay to ensure DOM updates)
    setTimeout(() => {
      setFormKey(k => k + 1);
    }, 50);
  };

  return (
    <form 
      ref={formRef}
      key={formKey} 
      onSubmit={handleSubmit} 
      className="bg-white rounded-lg shadow-md p-6 mb-6" 
      autoComplete="off"
    >
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
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
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
            data-lpignore="true"
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
            data-lpignore="true"
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
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
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
            data-lpignore="true"
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
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
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
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
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
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
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
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
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
