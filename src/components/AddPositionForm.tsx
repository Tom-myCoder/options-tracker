'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { OptionPosition } from '@/types/options';
import { savePosition, updatePosition, generateId } from '@/lib/storage';

interface AddPositionFormProps {
  onAdd: () => void;
  editPosition?: OptionPosition | null;
  onCancelEdit?: () => void;
}

export default function AddPositionForm({ onAdd, editPosition, onCancelEdit }: AddPositionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [expiryOptions, setExpiryOptions] = useState<string[]>([]);
  const [loadingExpiries, setLoadingExpiries] = useState(false);
  const [expiryMode, setExpiryMode] = useState<'select' | 'custom'>('select');

  const isEditing = !!editPosition;

  // Reset form when switching between add/edit modes
  useEffect(() => {
    if (editPosition && formRef.current) {
      const form = formRef.current;
      const suffix = resetCounter;
      
      // Populate form with edit data
      const tickerInput = form.querySelector(`input[name="ticker_${suffix}"]`) as HTMLInputElement;
      const optionTypeSelect = form.querySelector(`select[name="optionType_${suffix}"]`) as HTMLSelectElement;
      const sideSelect = form.querySelector(`select[name="side_${suffix}"]`) as HTMLSelectElement;
      const strikeInput = form.querySelector(`input[name="strike_${suffix}"]`) as HTMLInputElement;
      const expiryInput = form.querySelector(`input[name="expiry_${suffix}"]`) as HTMLInputElement;
      const expirySelect = form.querySelector(`select[name="expiry_${suffix}"]`) as HTMLSelectElement;
      const quantityInput = form.querySelector(`input[name="quantity_${suffix}"]`) as HTMLInputElement;
      const entryPriceInput = form.querySelector(`input[name="entryPrice_${suffix}"]`) as HTMLInputElement;
      const brokerInput = form.querySelector(`input[name="broker_${suffix}"]`) as HTMLInputElement;
      const purchaseDateInput = form.querySelector(`input[name="purchaseDate_${suffix}"]`) as HTMLInputElement;
      const notesTextarea = form.querySelector(`textarea[name="notes_${suffix}"]`) as HTMLTextAreaElement;

      if (tickerInput) tickerInput.value = editPosition.ticker;
      if (optionTypeSelect) optionTypeSelect.value = editPosition.optionType;
      if (sideSelect) sideSelect.value = editPosition.side;
      if (strikeInput) strikeInput.value = editPosition.strike.toString();
      if (quantityInput) quantityInput.value = editPosition.quantity.toString();
      if (entryPriceInput) entryPriceInput.value = editPosition.entryPrice.toString();
      if (brokerInput) brokerInput.value = editPosition.broker || '';
      if (purchaseDateInput) purchaseDateInput.value = editPosition.purchaseDate || '';
      if (notesTextarea) notesTextarea.value = editPosition.notes || '';
      
      // Handle expiry
      if (expirySelect) {
        expirySelect.value = editPosition.expiry;
      } else if (expiryInput) {
        expiryInput.value = editPosition.expiry;
      }
    }
  }, [editPosition, resetCounter]);

  const resetForm = useCallback(() => {
    if (formRef.current) {
      formRef.current.reset();
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
    const used = resetCounter;
    
    const expiryValue = String(formData.get(`expiry_${used}`) || '');
    const purchaseDateValue = String(formData.get(`purchaseDate_${used}`) || '').trim();

    if (isEditing && editPosition) {
      // Update existing position
      const updates: Partial<OptionPosition> = {
        ticker: String(formData.get(`ticker_${used}`) || '').toUpperCase(),
        optionType: String(formData.get(`optionType_${used}`) || 'call') as 'call' | 'put',
        side: String(formData.get(`side_${used}`) || 'buy') as 'buy' | 'sell',
        strike: parseFloat(String(formData.get(`strike_${used}`) || '0')),
        expiry: expiryValue,
        quantity: parseInt(String(formData.get(`quantity_${used}`) || '0')),
        entryPrice: parseFloat(String(formData.get(`entryPrice_${used}`) || '0')),
        purchaseDate: purchaseDateValue || undefined,
        notes: String(formData.get(`notes_${used}`) || '').trim() || undefined,
        broker: String(formData.get(`broker_${used}`) || '').trim() || undefined,
      };
      updatePosition(editPosition.id, updates);
    } else {
      // Create new position
      const position: OptionPosition = {
        id: generateId(),
        ticker: String(formData.get(`ticker_${used}`) || '').toUpperCase(),
        optionType: String(formData.get(`optionType_${used}`) || 'call') as 'call' | 'put',
        side: String(formData.get(`side_${used}`) || 'buy') as 'buy' | 'sell',
        strike: parseFloat(String(formData.get(`strike_${used}`) || '0')),
        expiry: expiryValue,
        quantity: parseInt(String(formData.get(`quantity_${used}`) || '0')),
        entryPrice: parseFloat(String(formData.get(`entryPrice_${used}`) || '0')),
        entryDate: new Date().toISOString().split('T')[0],
        purchaseDate: purchaseDateValue || undefined,
        notes: String(formData.get(`notes_${used}`) || '').trim() || undefined,
        broker: String(formData.get(`broker_${used}`) || '').trim() || undefined,
      };
      savePosition(position);
    }

    onAdd();
    resetForm();
    
    // Clear editing state
    if (isEditing && onCancelEdit) {
      onCancelEdit();
    }

    if (formRef.current) {
      const inputs = formRef.current.querySelectorAll('input, textarea, select');
      inputs.forEach((input) => {
        try {
          (input as HTMLInputElement).autocomplete = `off-${Math.random().toString(36).slice(2,8)}` as any;
        } catch (e) {}
        try {
          (input as HTMLInputElement).readOnly = true;
          (input as HTMLInputElement).value = '';
          (input as HTMLInputElement).blur();
        } catch (e) {}
      });
      setTimeout(() => {
        inputs.forEach((input) => {
          try { (input as HTMLInputElement).readOnly = false; } catch(e) {}
        });
      }, 300);
    }
    
    setResetCounter(c => c + 1);
    setIsSubmitting(false);
  };

  const suffix = resetCounter;
  
  return (
    <form 
      ref={formRef}
      onSubmit={handleSubmit} 
      className="bg-white rounded-lg shadow-md p-6 mb-6"
      autoComplete="off"
      style={{ opacity: isSubmitting ? 0.7 : 1 }}
    >
      <div style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden>
        <input name="username" autoComplete="username" />
        <input name="password" autoComplete="current-password" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-black">
          {isEditing ? 'Edit Position' : 'Add New Position'}
        </h2>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Ticker Symbol
          </label>
          <input
            key={`ticker-${suffix}`}
            type="text"
            name={`ticker_${suffix}`}
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
            name={`optionType_${suffix}`}
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
            name={`side_${suffix}`}
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
            name={`strike_${suffix}`}
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
          {loadingExpiries ? (
            <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500">Loading…</div>
          ) : expiryOptions && expiryOptions.length > 0 ? (
            <>
              <select
                key={`expiry-${suffix}`}
                name={`expiry_${suffix}`}
                defaultValue={expiryOptions[0]}
                autoComplete="off"
                data-lpignore="true"
                data-1pignore="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setExpiryMode('custom');
                  } else {
                    setExpiryMode('select');
                  }
                }}
              >
                {expiryOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="__custom__">Custom date…</option>
              </select>
              {expiryMode === 'custom' && (
                <input
                  type="date"
                  key={`expiry-custom-${suffix}`}
                  name={`expiry_${suffix}`}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
                />
              )}
            </>
          ) : (
            <input
              key={`expiry-${suffix}`}
              type="date"
              name={`expiry_${suffix}`}
              required
              autoComplete="off"
              data-lpignore="true"
              data-1pignore="true"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
            />
          )}
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
            name={`quantity_${suffix}`}
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
            name={`entryPrice_${suffix}`}
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
            Purchase Date (optional)
          </label>
          <input
            key={`purchaseDate-${suffix}`}
            type="date"
            name={`purchaseDate_${suffix}`}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            data-1pignore="true"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-1">
            Broker (optional)
          </label>
          <input
            key={`broker-${suffix}`}
            type="text"
            name={`broker_${suffix}`}
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
          name={`notes_${suffix}`}
          placeholder="Strategy, thesis, stop loss, etc."
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          data-1pignore="true"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-700 font-medium"
          rows={2}
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Position' : 'Add Position')}
        </button>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setResetCounter(c => c + 1);
            if (isEditing && onCancelEdit) {
              onCancelEdit();
            }
            setTimeout(() => {
              try { (formRef.current?.querySelector('input[name^="ticker_"]') as HTMLInputElement | null)?.focus(); } catch (e) {}
            }, 50);
          }}
          className="mt-3 md:mt-0 w-full md:w-auto px-6 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {isEditing ? 'Cancel' : 'Clear fields'}
        </button>
      </div>
    </form>
  );
}
