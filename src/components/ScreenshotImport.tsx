'use client';

import { useState, useRef, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { generateId } from '@/lib/storage';

interface ExtractedPosition {
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  broker?: string;
  confidence: 'high' | 'medium' | 'low';
  selected?: boolean;
}

interface ScreenshotImportProps {
  onImport: (positions: OptionPosition[]) => void;
  onCancel: () => void;
}

export default function ScreenshotImport({ onImport, onCancel }: ScreenshotImportProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedPositions, setExtractedPositions] = useState<ExtractedPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brokerDetected, setBrokerDetected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WEBP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setError(null);
      setExtractedPositions([]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: selectedImage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze screenshot');
      }

      if (data.totalPositions === 0) {
        setError('No option positions detected in screenshot. Try a clearer image or manual entry.');
        setExtractedPositions([]);
      } else {
        // Mark all as selected by default
        setExtractedPositions(data.positions.map((p: ExtractedPosition) => ({ ...p, selected: true })));
        setBrokerDetected(data.brokerDetected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze screenshot');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedImage]);

  const toggleSelection = (index: number) => {
    setExtractedPositions(prev => 
      prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p)
    );
  };

  const updatePosition = (index: number, field: keyof ExtractedPosition, value: any) => {
    setExtractedPositions(prev =>
      prev.map((p, i) => i === index ? { ...p, [field]: value } : p)
    );
  };

  const handleImport = () => {
    const selectedPositions = extractedPositions
      .filter(p => p.selected)
      .map(p => ({
        id: generateId(),
        ticker: p.ticker.toUpperCase(),
        optionType: p.optionType,
        side: p.side,
        strike: p.strike,
        expiry: p.expiry,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        entryDate: new Date().toISOString().split('T')[0],
        broker: p.broker || brokerDetected || undefined,
      } as OptionPosition));

    onImport(selectedPositions);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const selectedCount = extractedPositions.filter(p => p.selected).length;

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Import from Screenshot</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Upload a screenshot of your brokerage positions. AI will extract the option data.
        </p>
      </div>

      <div className="p-6">
        {/* File Upload */}
        {!selectedImage && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Select Screenshot
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Supports JPG, PNG, WEBP (max 5MB)
            </p>
          </div>
        )}

        {/* Image Preview */}
        {selectedImage && (
          <div className="mb-4">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={selectedImage}
                alt="Screenshot preview"
                className="max-h-64 mx-auto object-contain"
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setExtractedPositions([]);
                  setError(null);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!extractedPositions.length && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Extract Positions
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="text-center py-8">
            <svg className="animate-spin h-10 w-10 mx-auto text-blue-600 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-600">Analyzing screenshot with AI...</p>
            <p className="text-xs text-gray-400 mt-1">This takes 5-10 seconds</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Extracted Positions */}
        {extractedPositions.length > 0 && (
          <div>
            {brokerDetected && (
              <p className="text-sm text-gray-600 mb-3">
                Broker detected: <span className="font-medium">{brokerDetected}</span>
              </p>
            )}

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {extractedPositions.length} position{extractedPositions.length !== 1 ? 's' : ''} detected
              </p>
              <button
                onClick={() => setExtractedPositions(prev => prev.map(p => ({ ...p, selected: true })))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {extractedPositions.map((position, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-3 ${position.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={position.selected}
                      onChange={() => toggleSelection(index)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-gray-900">{position.ticker}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${position.optionType === 'call' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {position.optionType.toUpperCase()}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(position.confidence)}`}>
                          {position.confidence} confidence
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-500">Strike</label>
                          <input
                            type="number"
                            value={position.strike}
                            onChange={(e) => updatePosition(index, 'strike', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Expiry (YYYY-MM-DD)</label>
                          <input
                            type="text"
                            value={position.expiry}
                            onChange={(e) => updatePosition(index, 'expiry', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Qty</label>
                          <input
                            type="number"
                            value={position.quantity}
                            onChange={(e) => updatePosition(index, 'quantity', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Entry $</label>
                          <input
                            type="number"
                            step="0.01"
                            value={position.entryPrice}
                            onChange={(e) => updatePosition(index, 'entryPrice', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        <select
                          value={position.side}
                          onChange={(e) => updatePosition(index, 'side', e.target.value)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          <option value="buy">Buy (Long)</option>
                          <option value="sell">Sell (Short)</option>
                        </select>
                        <select
                          value={position.optionType}
                          onChange={(e) => updatePosition(index, 'optionType', e.target.value)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {selectedCount} Position{selectedCount !== 1 ? 's' : ''}
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-3 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500">
            🔒 <strong>Privacy:</strong> Screenshots are sent to OpenAI for analysis. 
            Crop out account numbers or personal info if desired. Images are processed but not stored.
          </p>
        </div>
      </div>
    </div>
  );
}
