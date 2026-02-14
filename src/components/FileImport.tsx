'use client';

import { useState, useRef, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { generateId, saveClosedPositions } from '@/lib/storage';
import * as XLSX from 'xlsx';

interface FileImportProps {
  onImport: (positions: OptionPosition[]) => void;
  onCancel: () => void;
}

interface ExtractedPosition {
  _id?: string;
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  entryDate?: string;
  transCode?: string;
  amount?: number;
  broker?: string;
  selected?: boolean;
  realizedPnl?: number | null;
  pairedWith?: string | null;
  rawData?: Record<string, any>;
}

export default function FileImport({ onImport, onCancel }: FileImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedPositionsOpen, setExtractedPositionsOpen] = useState<ExtractedPosition[]>([]);
  const [extractedPositionsClosed, setExtractedPositionsClosed] = useState<ExtractedPosition[]>([]);
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
    setExtractedPositionsOpen([]);
                  setExtractedPositionsClosed([]);
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
        // Try exact match first
        if (row[name]) return row[name].trim();
        // Try lowercase match
        const lowerKey = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
        if (lowerKey && row[lowerKey]) return row[lowerKey].trim();
      }
      return '';
    };

    // Check for Robinhood-style format (Description field contains option details)
    const description = getValue(['description', 'desc']);
    const instrument = getValue(['instrument', 'symbol', 'ticker']);
    const transCode = getValue(['trans code', 'trans_code', 'transaction code', 'type', 'trans']);
    
    // Try to parse option details from Description (e.g., "PLTR 2/20/2026 Put $157.50")
    let ticker = instrument;
    let optionType: 'call' | 'put' = 'call';
    let strike = 0;
    let expiry = '';
    let side: 'buy' | 'sell' = 'buy';
    let quantity = 0;
    let entryPrice = 0;
    let amountVal = 0;

    // Parse Robinhood Description format: find anywhere in the Description
    // e.g. "... PLTR 2/20/2026 Put $157.50 ..." (not necessarily at start)
    const robinhoodMatch = description.match(/(\w+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Put|Call)\s+\$([\d.,]+)/i) ||
                            (instrument || '').match(/(\w+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Put|Call)\s+\$([\d.,]+)/i);
    if (robinhoodMatch) {
      ticker = robinhoodMatch[1];
      expiry = parseDate(robinhoodMatch[2]);
      optionType = robinhoodMatch[3].toLowerCase() as 'call' | 'put';
      strike = parseFloat(String(robinhoodMatch[4]).replace(/,/g, '')) || 0;
      
      // Determine side from Trans Code
      // STO = Sell to Open (sell), BTC = Buy to Close (buy to close short)
      // OASGN = Assignment (could be either)
      const transCodeUpper = (transCode || '').toUpperCase();
      if (transCodeUpper === 'STO' || transCodeUpper === 'SELL') {
        side = 'sell';
      } else if (transCodeUpper === 'BTC' || transCodeUpper === 'BUY' || transCodeUpper === 'BTO') {
        // BTC/BTO means buying to close or buy to open; treat BTC as closing of a sell
        side = 'sell'; // We'll categorize by transCode later
      } else if (transCodeUpper === 'OASGN') {
        // Assignment - treat as closed (side=sell originally)
        side = 'sell';
      }
      
      // Get quantity
      let qtyStr = getValue(['quantity', 'qty']);
      quantity = Math.abs(parseInt(qtyStr) || 0);
      // If quantity missing, try to extract a number from description (e.g., "3 PLTR Options Assigned")
      if (quantity === 0 && description) {
        const qtyMatch = description.match(/(\d+)\s+(?:\w+\s+)?Options?\b/i) || description.match(/(\d+)\s+\w+\s+Option/i) || description.match(/^(\d+)\b/);
        if (qtyMatch) {
          quantity = Math.abs(parseInt(qtyMatch[1]) || 0);
        }
      }
      
      // Get price - for options, look at the Amount field / (quantity * 100)
      const priceStr = getValue(['price']);
      const amountStr = getValue(['amount']);
      
      if (priceStr && parseFloat(priceStr) > 0) {
        entryPrice = parseFloat(priceStr);
      } else if (amountStr && quantity > 0) {
        // Amount is total, divide by quantity * 100 to get per-contract price
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
        amountVal = amount;
        entryPrice = Math.abs(amount) / (quantity * 100);
      }
    } else {
      // Standard format parsing
      ticker = getValue(['symbol', 'ticker', 'underlying', 'sym']);
      if (!ticker) return null;

      const typeStr = getValue(['type', 'option type', 'callput', 'option_type']);
      if (typeStr.toLowerCase().includes('put') || typeStr === 'P') optionType = 'put';
      if (typeStr.toLowerCase().includes('call') || typeStr === 'C') optionType = 'call';

      const sideStr = getValue(['side', 'action', 'buy/sell', 'position']);
      const qtyStr = getValue(['qty', 'quantity', 'contracts', 'size']);
      if (qtyStr.startsWith('-') || 
          sideStr.toLowerCase().includes('sell') || 
          sideStr.toLowerCase().includes('short') ||
          sideStr.toLowerCase().includes('credit')) {
        side = 'sell';
      }

      const strikeStr = getValue(['strike', 'strike price', 'strike_price']);
      strike = parseFloat(strikeStr.replace(/[^0-9.]/g, '')) || 0;

      const expiryStr = getValue(['expiry', 'expiration', 'exp date', 'expiration date', 'expiry_date']);
      expiry = parseDate(expiryStr);

      quantity = Math.abs(parseInt(qtyStr.replace(/[^0-9-]/g, '')) || 0);

      const priceStr = getValue(['entry', 'entry price', 'cost', 'avg entry', 'entry_price', 'trade price', 'price']);
      entryPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
    }

    if (!ticker || strike === 0 || quantity === 0) {
      return null; // Not a valid option position
    }

    // Detect broker
    const broker = detectBroker(row) || 'Robinhood'; // Default to Robinhood for this format

    const dateStr = getValue(['activity date','process date','settle date','activity_date','process_date','settle_date']);
    const entryDate = parseDate(dateStr);

    return {
      _id: `${ticker.toUpperCase()}-${optionType}-${strike}-${expiry}-${Math.random().toString(36).slice(2,8)}`,
      ticker: ticker.toUpperCase(),
      optionType,
      side,
      strike,
      expiry,
      quantity,
      entryPrice,
      entryDate,
      transCode: transCode || undefined,
      amount: amountVal || undefined,
      broker,
      selected: true,
      realizedPnl: null,
      pairedWith: null,
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
        setExtractedPositionsOpen([]);
        setExtractedPositionsClosed([]);
      } else {
        // Filter to only valid option rows (must have ticker, strike>0, expiry, optionType, AND description containing Put/Call)
        const validPositions = positions.filter(p => {
          const hasOptionFormat = p.ticker && p.ticker.length > 0 && 
            p.strike > 0 && 
            p.expiry && p.expiry.length > 0 && 
            (p.optionType === 'call' || p.optionType === 'put');
          // Also check raw description contains Put or Call (filters out underlying stock buys, CUSIP rows, fees)
          const rawDesc = (p.rawData?.['description'] || p.rawData?.['Description'] || '').toLowerCase();
          const hasPutOrCall = rawDesc.includes('put') || rawDesc.includes('call');
          return hasOptionFormat && hasPutOrCall;
        });

        // Classify into Open (STO) and Closed (BTC/OASGN/others)
        const open: ExtractedPosition[] = [];
        const closed: ExtractedPosition[] = [];

        // First, separate by transCode if available
        for (const p of validPositions) {
          const tc = (p.transCode || '').toUpperCase();
          if (tc === 'STO' || tc === 'SELL' || tc === 'STO-OPEN') {
            open.push({ ...p });
          } else if (tc === 'BTC' || tc === 'OASGN' || tc === 'BTO' || tc === 'BUY') {
            closed.push({ ...p });
          } else {
            // Heuristic: if transCode is missing, treat as open if side==='sell'
            if (p.side === 'sell') open.push({ ...p });
            else closed.push({ ...p });
          }
        }

        // Aggregate identical open positions (same ticker, type, strike, expiry, side, entryPrice)
        const aggregatedOpen: ExtractedPosition[] = [];
        const openAggregationMap: Record<string, ExtractedPosition> = {};
        for (const o of open) {
          const aggKey = `${o.ticker}|${o.optionType}|${o.strike}|${o.expiry}|${o.side}|${o.entryPrice}|${o.entryDate || ''}`;
          if (openAggregationMap[aggKey]) {
            openAggregationMap[aggKey].quantity += o.quantity;
          } else {
            openAggregationMap[aggKey] = { ...o };
            aggregatedOpen.push(openAggregationMap[aggKey]);
          }
        }

        // Attempt pairing closed items with opens to compute realized P&L
        const opensByKey: Record<string, ExtractedPosition[]> = {};
        for (const o of aggregatedOpen) {
          const key = `${o.ticker}|${o.optionType}|${o.strike}|${o.expiry}`;
          if (!opensByKey[key]) opensByKey[key] = [];
          // track remainingQuantity for pairing
          (o as any).remaining = o.quantity;
          opensByKey[key].push(o);
        }

        for (const c of closed) {
          const key = `${c.ticker}|${c.optionType}|${c.strike}|${c.expiry}`;
          const pool = opensByKey[key] || [];
          let remainingToMatch = c.quantity;
          for (const o of pool) {
            const oRemaining = (o as any).remaining || 0;
            if (oRemaining <= 0) continue;
            const matchQty = Math.min(oRemaining, remainingToMatch);
            if (matchQty <= 0) continue;

            // Always track the pairing (even without price for P&L)
            c.pairedWith = o._id || null;
            (o as any).remaining = oRemaining - matchQty;
            remainingToMatch -= matchQty;

            // Compute realized P&L per contract: (open.entryPrice - close.entryPrice) * 100
            // For assignments (OASGN), close.entryPrice is often 0 (assignment at strike)
            // For BTC, close.entryPrice is the buyback price
            if (o.entryPrice) {
              const closePrice = c.entryPrice || 0;
              const pnlPer = (o.entryPrice - closePrice) * 100;
              const pnl = pnlPer * matchQty;
              c.realizedPnl = (c.realizedPnl || 0) + pnl;
            }

            if (remainingToMatch <= 0) break;
          }
        }

        // Filter out fully-closed open positions (remaining === 0 after pairing)
        const stillOpen = aggregatedOpen.filter(o => (o as any).remaining > 0);
        
        // Auto-save closed positions to history (for P&L tracking)
        // These are trades that have been closed/assigned - save them even if not imported as positions
        const closedForHistory = closed.map(c => ({
          id: generateId(),
          ticker: c.ticker.toUpperCase(),
          optionType: c.optionType,
          side: c.side,
          strike: c.strike,
          expiry: c.expiry,
          quantity: c.quantity,
          entryPrice: c.entryPrice || 0,
          closePrice: c.entryPrice || 0, // For closed positions, this is the closing price
          entryDate: c.entryDate || new Date().toISOString().split('T')[0],
          closeDate: new Date().toISOString().split('T')[0],
          realizedPnl: c.realizedPnl || 0,
          broker: c.broker || brokerDetected || undefined,
          notes: `trans:${c.transCode || ''}; paired:${c.pairedWith ? 'yes' : 'no'}`,
          importedFrom: 'CSV Auto-import',
          importDate: new Date().toISOString()
        }));
        saveClosedPositions(closedForHistory);
        
        setExtractedPositionsOpen(stillOpen);
        setExtractedPositionsClosed(closed);
        setBrokerDetected(positions[0]?.broker || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  const toggleSelectionOpen = (index: number) => {
    setExtractedPositionsOpen(prev => 
      prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p)
    );
  };

  const updateOpenPosition = (index: number, field: keyof ExtractedPosition, value: any) => {
    setExtractedPositionsOpen(prev =>
      prev.map((p, i) => i === index ? { ...p, [field]: value } : p)
    );
  };

  const toggleSelectionClosed = (index: number) => {
    setExtractedPositionsClosed(prev => 
      prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p)
    );
  };

  const updateClosedPosition = (index: number, field: keyof ExtractedPosition, value: any) => {
    setExtractedPositionsClosed(prev =>
      prev.map((p, i) => i === index ? { ...p, [field]: value } : p)
    );
  };

  const handleImport = () => {
    // Import selected OPEN positions to main portfolio
    const selectedOpenPositions = extractedPositionsOpen
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
        entryDate: p.entryDate || new Date().toISOString().split('T')[0],
        broker: p.broker || brokerDetected || undefined,
      } as OptionPosition));

    // Import selected CLOSED positions to history
    const selectedClosedForHistory = extractedPositionsClosed
      .filter(p => p.selected)
      .map(p => ({
        id: generateId(),
        ticker: p.ticker.toUpperCase(),
        optionType: p.optionType,
        side: p.side,
        strike: p.strike,
        expiry: p.expiry,
        quantity: p.quantity,
        entryPrice: p.entryPrice || 0,
        closePrice: p.entryPrice || 0,
        entryDate: p.entryDate || new Date().toISOString().split('T')[0],
        closeDate: new Date().toISOString().split('T')[0],
        realizedPnl: p.realizedPnl || 0,
        broker: p.broker || brokerDetected || undefined,
        notes: `trans:${p.transCode || ''}; paired:${p.pairedWith ? 'yes' : 'no'}`,
        importedFrom: 'CSV Import',
        importDate: new Date().toISOString()
      }));

    // Save closed positions to history
    if (selectedClosedForHistory.length > 0) {
      saveClosedPositions(selectedClosedForHistory);
    }

    // Import open positions to main portfolio
    onImport(selectedOpenPositions);
  };

  const selectedOpenCount = extractedPositionsOpen.filter(p => p.selected).length;
  const selectedClosedCount = extractedPositionsClosed.filter(p => p.selected).length;
  const totalSelectedCount = selectedOpenCount + selectedClosedCount;

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
                  setExtractedPositionsOpen([]);
                  setExtractedPositionsClosed([]);
                  setError(null);
                }}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!extractedPositionsOpen.length && !isAnalyzing && (
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
        {(extractedPositionsOpen.length > 0 || extractedPositionsClosed.length > 0) && (
          <div className="space-y-4">
            {brokerDetected && (
              <p className="text-sm text-gray-600">
                Broker detected: <span className="font-medium">{brokerDetected}</span>
              </p>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <span className="text-sm font-medium text-gray-700">
                {selectedOpenCount} of {extractedPositionsOpen.length} open, {selectedClosedCount} of {extractedPositionsClosed.length} closed selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setExtractedPositionsOpen(prev => prev.map(p => ({ ...p, selected: true })));
                    setExtractedPositionsClosed(prev => prev.map(p => ({ ...p, selected: true })));
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => {
                    setExtractedPositionsOpen(prev => prev.map(p => ({ ...p, selected: false })));
                    setExtractedPositionsClosed(prev => prev.map(p => ({ ...p, selected: false })));
                  }}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Open Positions Section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-900">
                    Open Positions ({extractedPositionsOpen.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExtractedPositionsOpen(prev => prev.map(p => ({ ...p, selected: true })))}
                      className="text-xs text-blue-700 hover:text-blue-900"
                    >
                      Select All
                    </button>
                    <span className="text-blue-300">|</span>
                    <button
                      onClick={() => setExtractedPositionsOpen(prev => prev.map(p => ({ ...p, selected: false })))}
                      className="text-xs text-blue-700 hover:text-blue-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                  {extractedPositionsOpen.map((position, index) => (
                    <div
                      key={position._id || index}
                      className={`border rounded-lg p-3 ${position.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={position.selected}
                          onChange={() => toggleSelectionOpen(index)}
                          className="mt-1 h-4 w-4 text-blue-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-gray-900">{position.ticker}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${position.optionType === 'call' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {position.optionType.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">{position.transCode || ''}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                            <div>
                              <label className="text-xs text-gray-500">Strike</label>
                              <input
                                type="number"
                                value={position.strike}
                                onChange={(e) => updateOpenPosition(index, 'strike', parseFloat(e.target.value))}
                                className="w-full px-2 py-1 border rounded text-sm text-black"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Expiry</label>
                              <input
                                type="text"
                                value={position.expiry}
                                onChange={(e) => updateOpenPosition(index, 'expiry', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-sm text-black"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Qty</label>
                              <input
                                type="number"
                                value={position.quantity}
                                onChange={(e) => updateOpenPosition(index, 'quantity', parseInt(e.target.value))}
                                className="w-full px-2 py-1 border rounded text-sm text-black"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Entry $</label>
                              <input
                                type="number"
                                step="0.01"
                                value={position.entryPrice}
                                onChange={(e) => updateOpenPosition(index, 'entryPrice', parseFloat(e.target.value))}
                                className="w-full px-2 py-1 border rounded text-sm text-black"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {extractedPositionsOpen.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No open positions detected</p>
                  )}
                </div>
              </div>

              {/* Closed Positions Section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Closed / Assigned ({extractedPositionsClosed.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExtractedPositionsClosed(prev => prev.map(p => ({ ...p, selected: true })))}
                      className="text-xs text-gray-700 hover:text-gray-900"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => setExtractedPositionsClosed(prev => prev.map(p => ({ ...p, selected: false })))}
                      className="text-xs text-gray-700 hover:text-gray-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                  {extractedPositionsClosed.map((position, index) => (
                    <div 
                      key={position._id || index} 
                      className={`border rounded-lg p-3 ${position.selected ? 'border-gray-500 bg-gray-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          checked={position.selected} 
                          onChange={() => toggleSelectionClosed(index)} 
                          className="mt-1 h-4 w-4 text-gray-600 rounded" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{position.ticker}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${position.optionType === 'call' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {position.optionType.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">{position.transCode || ''}</span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>{position.strike} • {position.expiry}</div>
                            <div>Qty: {position.quantity} • Entry: ${position.entryPrice}</div>
                            {position.realizedPnl != null && (
                              <div className={`font-medium ${position.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Realized P&L: {position.realizedPnl >= 0 ? '+' : ''}${position.realizedPnl.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {extractedPositionsClosed.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No closed positions detected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Import Button */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={totalSelectedCount === 0}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {totalSelectedCount === 0 
                  ? 'Select positions to import' 
                  : `Import ${selectedOpenCount > 0 ? `${selectedOpenCount} open` : ''}${selectedOpenCount > 0 && selectedClosedCount > 0 ? ' + ' : ''}${selectedClosedCount > 0 ? `${selectedClosedCount} closed` : ''}`
                }
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300"
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
