'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { OptionPosition } from '@/types/options';
import { savePosition, generateId } from '@/lib/storage';

interface AddPositionFormProps {
  onAdd: () => void;
}

export default function AddPositionForm({ onAdd }: AddPositionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const resetForm = useCallback(() => {
    if (formRef.current) {
      // Native form reset
      formRef.current.reset();
      
      // Force clear all inputs manually
      const inputs = formRef.current.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => {
        const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (el.tagName === 'SELECT') {
          const select = el as HTMLSelectElement;
          if (select.name.includes('optionType')) {
            select.value = 'call';
          } else if (select.name.includes('side')) {
            select.value = 'buy';
          }
        } else {
          (el as HTMLInputElement).value = '';
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    // Aggressive form reset
    resetForm();
    
    // Force re-render with new counter
    setResetCounter(c => c + 1);
    
    setIsSubmitting(false);
  };

  // Generate unique names based on reset counter to defeat autofill
  const suffix = resetCounter;
  
  return (
    <form 
      ref={formRef}
      onSubmit={handleSubmit} 
      className="bg-white rounded-lg shadow-md p-6 mb-6"
      autoComplete="off"
      style={{ opacity: isSubmitting ? 0.7 : 1 }}
    >
      <h2 className="text-xl font-bold text-black mb-4">Add New Position</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Ticker Symbol
          </label>
          <input
            key={`ticker-${suffix}`}
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
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Option Type
          </label>
          <select
            key={`optionType-${suffix}`}
            name="optionType"
            defaultValue="call"
            autoComplete="off"
            data-lpignore="true"
            data-1pignore="true"
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
            key={`side-${suffix}`}
            name="side"
            defaultValue="buy"
            autoComplete="off"
            data-lpignore="true"
            data-1pignore="true"
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
            key={`strike-${suffix}`}
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            name="strike"
            required
            placeholder="120.00"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Expiry Date
          </label>
          <input
            key={`expiry-${suffix}`}
            type="date"
            name="expiry"
            required
            autoComplete="off"
            data-lpignore="true"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Quantity (Contracts)
          </label>
          <input
            key={`quantity-${suffix}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="quantity"
            required
            placeholder="1"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Entry Price per Contract ($)
          </label>
          <input
            key={`entryPrice-${suffix}`}
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            name="entryPrice"
            required
            placeholder="5.00"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Broker (optional)
          </label>
          <input
            key={`broker-${suffix}`}
            type="text"
            name="broker"
            placeholder="e.g., TD, Robinhood"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-bold text-black mb-1">
          Notes (optional)
        </label>
        <textarea
          key={`notes-${suffix}`}
          name="notes"
          placeholder="Strategy, thesis, stop loss, etc."
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          data-1pignore="true"
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
