'use client';

import { useState, useRef, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { generateId } from '@/lib/storage';
import * as XLSX from 'xlsx';

interface FileImportProps {
  onImport: (positions: OptionPosition[]) => void;
  onCancel: () => void;
}

interface ExtractedPosition {
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  broker?: string;
  selected?: boolean;
  rawData?: Record<string, any>;
}

export default function FileImport({ onImport, onCancel }: FileImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedPositions, setExtractedPositions] = useState<ExtractedPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brokerDetected, setBrokerDetected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf'
    ];
    
    const validExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension && !validTypes.includes(file.type)) {
      setError('Please select a CSV, Excel (.xls, .xlsx), or PDF file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setExtractedPositions([]);
  }, []);

  const parseCSV = async (text: string): Promise<ExtractedPosition[]> => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Try to detect header row
    const headers = parseCSVLine(lines[0]);
    
    const positions: ExtractedPosition[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue; // Skip empty/short lines
      
      const rowData: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowData[h.toLowerCase().trim()] = cols[idx] || '';
      });
      
      const position = extractPositionFromRow(rowData);
      if (position) {
        positions.push(position);
      }
    }
    
    return positions;
  };

  const parseExcel = async (arrayBuffer: ArrayBuffer): Promise<ExtractedPosition[]> => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    if (data.length < 2) return [];
    
    const headers = (data[0] as string[]).map(h => String(h).toLowerCase().trim());
    const positions: ExtractedPosition[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;
      
      const rowData: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowData[h] = String(row[idx] || '');
      });
      
      const position = extractPositionFromRow(rowData);
      if (position) {
        positions.push(position);
      }
    }
    
    return positions;
  };

  const parsePDF = async (file: File): Promise<ExtractedPosition[]> => {
    // For PDF, we'll use the OpenAI API to extract text
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const response = await fetch('/api/analyze-screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageBase64: `data:application/pdf;base64,${base64}`,
        isPDF: true 
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze PDF');
    }

    const data = await response.json();
    return data.positions.map((p: any) => ({
      ...p,
      selected: true,
    }));
  };

  const extractPositionFromRow = (row: Record<string, string>): ExtractedPosition | null => {
    // Helper to find value by possible column names
    const getValue = (possibleNames: string[]): string => {
      for (const name of possibleNames) {
        const value = row[name.toLowerCase()];
        if (value && value.trim()) return value.trim();
      }
      return '';
    };

    const ticker = getValue(['symbol', 'ticker', 'underlying', 'sym']);
    if (!ticker) return null;

    // Detect option type
    const typeStr = getValue(['type', 'option type', 'callput', 'option_type']);
    let optionType: 'call' | 'put' = 'call';
    if (typeStr.toLowerCase().includes('put') || typeStr === 'P') optionType = 'put';
    if (typeStr.toLowerCase().includes('call') || typeStr === 'C') optionType = 'call';

    // Detect side
    const sideStr = getValue(['side', 'action', 'buy/sell', 'position']);
    let side: 'buy' | 'sell' = 'buy';
    const qtyStr = getValue(['qty', 'quantity', 'contracts', 'size']);
    if (qtyStr.startsWith('-') || 
        sideStr.toLowerCase().includes('sell') || 
        sideStr.toLowerCase().includes('short') ||
        sideStr.toLowerCase().includes('credit')) {
      side = 'sell';
    }

    // Parse strike
    const strikeStr = getValue(['strike', 'strike price', 'strike_price']);
    const strike = parseFloat(strikeStr.replace(/[^0-9.]/g, '')) || 0;

    // Parse expiry - try multiple formats
    const expiryStr = getValue(['expiry', 'expiration', 'exp date', 'expiration date', 'expiry_date']);
    let expiry = parseDate(expiryStr);

    // Parse quantity
    const quantity = Math.abs(parseInt(qtyStr.replace(/[^0-9-]/g, '')) || 0);

    // Parse entry price
    const priceStr = getValue(['entry', 'entry price', 'cost', 'avg entry', 'entry_price', 'trade price', 'price']);
    const entryPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

    // Detect broker
    const broker = detectBroker(row);

    return {
      ticker: ticker.toUpperCase(),
      optionType,
      side,
      strike,
      expiry,
      quantity,
      entryPrice,
      broker,
      selected: true,
      rawData: row,
    };
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // Try various date formats
    const formats = [
      // MM/DD/YYYY
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, fn: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
      // MM-DD-YYYY
      { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, fn: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
      // YYYY-MM-DD
      { regex: /^(\d{4})-(\d{2})-(\d{2})$/, fn: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
      // MMM DD YYYY (e.g., Feb 21 2025)
      { regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})$/i, fn: (m: RegExpMatchArray) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = (months.indexOf(m[1]) + 1).toString().padStart(2, '0');
        return `${m[3]}-${month}-${m[2].padStart(2, '0')}`;
      }},
    ];

    for (const format of formats) {
      const match = dateStr.match(format.regex);
      if (match) return format.fn(match);
    }

    // Fallback: try native Date parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  };

  const detectBroker = (row: Record<string, string>): string | undefined => {
    // Check if any column header or value contains broker name
    const allText = Object.values(row).join(' ').toLowerCase();
    const brokers = ['schwab', 'td', 'ameritrade', 'robinhood', 'fidelity', 'e*trade', 'ibkr', 'interactive'];
    for (const broker of brokers) {
      if (allText.includes(broker)) {
        return broker.charAt(0).toUpperCase() + broker.slice(1);
      }
    }
    return undefined;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      let positions: ExtractedPosition[] = [];
      const fileName = selectedFile.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const text = await selectedFile.text();
        positions = await parseCSV(text);
      } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        positions = await parseExcel(arrayBuffer);
      } else if (fileName.endsWith('.pdf')) {
        positions = await parsePDF(selectedFile);
      }

      if (positions.length === 0) {
        setError('No option positions detected in file. Check the format or try manual entry.');
        setExtractedPositions([]);
      } else {
        setExtractedPositions(positions);
        setBrokerDetected(positions[0]?.broker || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

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

  const selectedCount = extractedPositions.filter(p => p.selected).length;

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Import from File</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Upload a CSV, Excel, or PDF export from your brokerage.
        </p>
      </div>

      <div className="p-6">
        {/* File Upload */}
        {!selectedFile && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Select File
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Supports CSV, Excel (.xls, .xlsx), PDF (max 10MB)
            </p>
          </div>
        )}

        {/* File Preview */}
        {selectedFile && (
          <div className="mb-4">
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setExtractedPositions([]);
                  setError(null);
                }}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    Parsing...
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
            <p className="text-gray-600">Parsing file...</p>
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
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-700 font-medium">Strike</label>
                          <input
                            type="number"
                            value={position.strike}
                            onChange={(e) => updatePosition(index, 'strike', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm text-black"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-700 font-medium">Expiry</label>
                          <input
                            type="text"
                            value={position.expiry}
                            onChange={(e) => updatePosition(index, 'expiry', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm text-black"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-700 font-medium">Qty</label>
                          <input
                            type="number"
                            value={position.quantity}
                            onChange={(e) => updatePosition(index, 'quantity', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm text-black"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-700 font-medium">Entry $</label>
                          <input
                            type="number"
                            step="0.01"
                            value={position.entryPrice}
                            onChange={(e) => updatePosition(index, 'entryPrice', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm text-black"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        <select
                          value={position.side}
                          onChange={(e) => updatePosition(index, 'side', e.target.value)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
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
      </div>
    </div>
  );
}
