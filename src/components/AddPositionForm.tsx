'use client';

import { useState, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { savePosition, generateId } from '@/lib/storage';

interface AddPositionFormProps {
  onAdd: () => void;
}

// Generate random string to defeat browser autofill
const randomId = () => Math.random().toString(36).substring(2, 8);

export default function AddPositionForm({ onAdd }: AddPositionFormProps) {
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate unique names for this form instance
  const formId = useCallback(() => randomId(), [formKey]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const position: OptionPosition = {
      id: generateId(),
      ticker: String(formData.get('ticker') || '').toUpperCase(),
      optionType: String(formData.get('optionType') || 'call') as 'call' | 'put',
      side: String(formData.get('side') || 'buy') as 'buy' | 'sell',
      strike: parseFloat(String(formData.get('strike') || '0')),
      expiry: String(formData.get('expiry') || ''),
      quantity: parseInt(String(formData.get('quantity') || '0')),
      entryPrice: parseFloat(String(formData.get('entryPrice') || '0')),
      entryDate: new Date().toISOString().split('T')[0],
      notes: String(formData.get('notes') || '').trim() || undefined,
      broker: String(formData.get('broker') || '').trim() || undefined,
    };

    // Save position
    savePosition(position);

    // Notify parent
    onAdd();

    // Completely remount the form to clear all browser state
    setTimeout(() => {
      setFormKey(k => k + 1);
      setIsSubmitting(false);
    }, 100);
  };

  // Unique field names for this form instance
  const fields = {
    ticker: `ticker_${formKey}`,
    optionType: `optionType_${formKey}`,
    side: `side_${formKey}`,
    strike: `strike_${formKey}`,
    expiry: `expiry_${formKey}`,
    quantity: `quantity_${formKey}`,
    entryPrice: `entryPrice_${formKey}`,
    broker: `broker_${formKey}`,
    notes: `notes_${formKey}`,
  };

  return (
    <form 
      key={formKey}
      onSubmit={handleSubmit} 
      className="bg-white rounded-lg shadow-md p-6 mb-6"
      autoComplete="off"
      style={{ opacity: isSubmitting ? 0.5 : 1 }}
    >
      <h2 className="text-xl font-bold text-black mb-4">Add New Position</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Ticker Symbol
          </label>
          <input
            type="text"
            name="ticker"
            required
            placeholder="NVDA"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck="false"
            data-lpignore="true"
            data-form-type="other"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Option Type
          </label>
          <select
            name="optionType"
            defaultValue="call"
            autoComplete="off"
            data-lpignore="true"
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
            name="side"
            defaultValue="buy"
            autoComplete="off"
            data-lpignore="true"
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
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            name="strike"
            required
            placeholder="120.00"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Expiry Date
          </label>
          <input
            type="date"
            name="expiry"
            required
            autoComplete="off"
            data-lpignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Quantity (Contracts)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="quantity"
            required
            placeholder="1"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Entry Price per Contract ($)
          </label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            name="entryPrice"
            required
            placeholder="5.00"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Broker (optional)
          </label>
          <input
            type="text"
            name="broker"
            placeholder="e.g., TD, Robinhood"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-bold text-black mb-1">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          placeholder="Strategy, thesis, stop loss, etc."
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Adding...' : 'Add Position'}
      </button>
    </form>
  );
}
