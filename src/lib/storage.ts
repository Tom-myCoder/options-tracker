import { OptionPosition, DATA_VERSION } from '@/types/options';

const STORAGE_KEY = 'options-tracker-positions';

// Migration function to handle old data formats
function migratePosition(position: any): OptionPosition {
  // Handle missing fields from older versions
  const migrated: OptionPosition = {
    id: position.id || generateId(),
    ticker: position.ticker || '',
    optionType: position.optionType || 'call',
    side: position.side || 'buy',
    strike: parseFloat(position.strike) || 0,
    expiry: position.expiry || '',
    quantity: parseInt(position.quantity) || 0,
    entryPrice: parseFloat(position.entryPrice) || 0,
    currentPrice: position.currentPrice ? parseFloat(position.currentPrice) : undefined,
    entryDate: position.entryDate || new Date().toISOString().split('T')[0],
    purchaseDate: position.purchaseDate || undefined,
    notes: position.notes || undefined,
    broker: position.broker || undefined,
    lastPriceUpdate: position.lastPriceUpdate ? Number(position.lastPriceUpdate) : undefined,
    priceHistory: Array.isArray(position.priceHistory) ? position.priceHistory : [],
    dataVersion: DATA_VERSION,
  };
  
  return migrated;
}

export const getPositions = (): OptionPosition[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Migrate any old data formats
    return parsed.map(migratePosition);
  } catch (e) {
    console.error('Error parsing stored positions:', e);
    return [];
  }
};

export const savePosition = (position: OptionPosition): void => {
  const positions = getPositions();
  // Ensure version is set
  const positionWithVersion = { ...position, dataVersion: DATA_VERSION };
  positions.push(positionWithVersion);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

export const updatePosition = (id: string, updates: Partial<OptionPosition>): void => {
  const positions = getPositions();
  const index = positions.findIndex(p => p.id === id);
  if (index !== -1) {
    positions[index] = { ...positions[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }
};

export const deletePosition = (id: string): void => {
  const positions = getPositions();
  const filtered = positions.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Batch update positions with new prices
export const updatePositions = (positions: OptionPosition[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

// Add a price snapshot to a position's history
export const addPriceSnapshot = (id: string, price: number, underlyingPrice?: number): void => {
  const positions = getPositions();
  const index = positions.findIndex(p => p.id === id);
  if (index === -1) return;
  
  const position = positions[index];
  const snapshot = {
    timestamp: Date.now(),
    price,
    underlyingPrice,
  };
  
  const history = position.priceHistory || [];
  // Keep last 90 days of history to avoid storage bloat
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filteredHistory = history.filter(h => h.timestamp > cutoff);
  filteredHistory.push(snapshot);
  
  position.priceHistory = filteredHistory;
  position.currentPrice = price;
  position.lastPriceUpdate = Date.now();
  
  positions[index] = position;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

// Export positions as CSV (simple header-based, backward compatible)
export const exportPositionsCSV = (): string => {
  const positions = getPositions();
  // Include dataVersion in CSV for future compatibility
  const header = ['id','ticker','optionType','side','strike','expiry','quantity','entryPrice','currentPrice','entryDate','purchaseDate','notes','broker','lastPriceUpdate','dataVersion'];
  const rows = positions.map(p => [
    p.id,
    p.ticker,
    p.optionType,
    p.side,
    String(p.strike),
    p.expiry,
    String(p.quantity),
    String(p.entryPrice),
    p.currentPrice != null ? String(p.currentPrice) : '',
    p.entryDate,
    p.purchaseDate || '',
    p.notes ? p.notes.replace(/"/g,'""') : '',
    p.broker ? p.broker : '',
    p.lastPriceUpdate ? String(p.lastPriceUpdate) : '',
    String(DATA_VERSION)
  ]);
  const csv = [header.join(','), ...rows.map(r => r.map(c=>`"${c}"`).join(','))].join('\n');
  return csv;
};

// Parse a single CSV line with quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (!inQuotes && char === '"') {
      inQuotes = true;
      i++;
    } else if (inQuotes && char === '"' && nextChar === '"') {
      // Escaped quote
      current += '"';
      i += 2;
    } else if (inQuotes && char === '"') {
      // End of quoted field
      inQuotes = false;
      i++;
    } else if (!inQuotes && char === ',') {
      // End of field
      fields.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  fields.push(current); // Last field
  return fields;
}

// Import CSV (overwrites stored positions) - backward compatible with missing columns
export const importPositionsCSV = (csvText: string): void => {
  if (typeof window === 'undefined') return;
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return;
  
  // Parse header line
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  
  // Helper to get value case-insensitively (handles old export formats)
  const getValue = (cols: string[], names: string[]): string => {
    for (const name of names) {
      const idx = header.indexOf(name.toLowerCase());
      if (idx >= 0 && idx < cols.length) {
        return cols[idx];
      }
    }
    return '';
  };
  
  const positions: OptionPosition[] = lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    
    // Support multiple header name variants for backward compatibility
    const id = getValue(cols, ['id', 'ID']);
    const ticker = getValue(cols, ['ticker', 'symbol', 'TICKER', 'SYMBOL']);
    const optionType = getValue(cols, ['optiontype', 'optionType', 'type', 'OPTIONTYPE', 'TYPE']);
    const side = getValue(cols, ['side', 'SIDE']);
    const strike = getValue(cols, ['strike', 'STRIKE']);
    const expiry = getValue(cols, ['expiry', 'expiration', 'EXPIRY', 'EXPIRATION', 'expiryDate']);
    const quantity = getValue(cols, ['quantity', 'qty', 'QUANTITY', 'QTY']);
    const entryPrice = getValue(cols, ['entryprice', 'entryPrice', 'price', 'ENTRYPRICE', 'PRICE']);
    const currentPrice = getValue(cols, ['currentprice', 'currentPrice', 'CURRENT_PRICE']);
    const entryDate = getValue(cols, ['entrydate', 'entryDate', 'ENTRYDATE', 'date']);
    const purchaseDate = getValue(cols, ['purchasedate', 'purchaseDate', 'PURCHASEDATE', 'purchase_date']);
    const notes = getValue(cols, ['notes', 'NOTES', 'note']);
    const broker = getValue(cols, ['broker', 'BROKER']);
    const lastPriceUpdate = getValue(cols, ['lastpriceupdate', 'lastPriceUpdate', 'LASTPRICEUPDATE']);
    
    return migratePosition({
      id: id || generateId(),
      ticker: ticker || '',
      optionType: (optionType as 'call' | 'put') || 'call',
      side: (side as 'buy' | 'sell') || 'buy',
      strike: parseFloat(strike || '0') || 0,
      expiry: expiry || '',
      quantity: parseInt(quantity || '0') || 0,
      entryPrice: parseFloat(entryPrice || '0') || 0,
      currentPrice: currentPrice ? parseFloat(currentPrice) : undefined,
      entryDate: entryDate || new Date().toISOString().split('T')[0],
      purchaseDate: purchaseDate || undefined,
      notes: notes || undefined,
      broker: broker || undefined,
      lastPriceUpdate: lastPriceUpdate ? Number(lastPriceUpdate) : undefined,
      priceHistory: [], // CSV doesn't include price history
    });
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

// Export/Import JSON for backup (includes full price history)
export const exportPositionsJSON = (): string => {
  const positions = getPositions().map(p => ({ ...p, dataVersion: DATA_VERSION }));
  return JSON.stringify(positions, null, 2);
};

export const importPositionsJSON = (jsonText: string): { success: boolean; count: number; errors: string[] } => {
  const errors: string[] = [];
  
  try {
    const data = JSON.parse(jsonText);
    
    if (!Array.isArray(data)) {
      errors.push('Invalid format: expected an array of positions');
      return { success: false, count: 0, errors };
    }
    
    // Validate and migrate each position
    const migratedPositions: OptionPosition[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      // Basic validation
      if (!item || typeof item !== 'object') {
        errors.push(`Item ${i + 1}: Invalid position data`);
        continue;
      }
      
      // Check for required fields (ticker is minimum)
      if (!item.ticker && !item.symbol) {
        errors.push(`Item ${i + 1}: Missing ticker/symbol`);
        continue;
      }
      
      try {
        const migrated = migratePosition(item);
        migratedPositions.push(migrated);
      } catch (e) {
        errors.push(`Item ${i + 1}: Failed to migrate - ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
    
    if (migratedPositions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedPositions));
    }
    
    return {
      success: migratedPositions.length > 0,
      count: migratedPositions.length,
      errors: errors.length > 0 ? errors : [],
    };
    
  } catch (e) {
    errors.push('Failed to parse JSON: ' + (e instanceof Error ? e.message : 'unknown error'));
    return { success: false, count: 0, errors };
  }
};

// Export positions with price history as expanded JSON for detailed analysis
export const exportPositionsWithHistoryJSON = (): string => {
  const positions = getPositions();
  const exportData = positions.map(p => ({
    ...p,
    priceHistoryCount: p.priceHistory?.length || 0,
    daysOfHistory: p.priceHistory && p.priceHistory.length > 0
      ? Math.ceil((Date.now() - Math.min(...p.priceHistory.map(h => h.timestamp))) / (1000 * 60 * 60 * 24))
      : 0,
  }));
  return JSON.stringify(exportData, null, 2);
};

// Fetch and store historical prices for a position
export const fetchAndStoreHistoricalPrices = async (position: OptionPosition): Promise<void> => {
  if (!position.purchaseDate) return;
  
  try {
    const url = `/api/option-history?ticker=${position.ticker}&expiry=${position.expiry}&strike=${position.strike}&type=${position.optionType}&from=${position.purchaseDate}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch historical prices');
    }
    
    const data = await response.json();
    
    if (data.prices && Array.isArray(data.prices)) {
      const positions = getPositions();
      const index = positions.findIndex(p => p.id === position.id);
      if (index === -1) return;
      
      // Convert API prices to PriceSnapshot format
      const historicalSnapshots = data.prices.map((p: { date: string; price: number; underlyingPrice?: number }) => ({
        timestamp: new Date(p.date).getTime(),
        price: p.price,
        underlyingPrice: p.underlyingPrice,
      }));
      
      // Merge with existing history, avoiding duplicates
      const existingHistory = positions[index].priceHistory || [];
      const existingTimestamps = new Set(existingHistory.map(h => h.timestamp));
      
      const newSnapshots = historicalSnapshots.filter(
        (s: { timestamp: number }) => !existingTimestamps.has(s.timestamp)
      );
      
      positions[index].priceHistory = [...existingHistory, ...newSnapshots].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    }
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    throw error;
  }
};

// Clear all positions from localStorage
export const clearAllPositions = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

const CLOSED_POSITIONS_KEY = 'options-tracker-closed-positions';

export interface ClosedPosition {
  id: string;
  ticker: string;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  entryPrice: number;
  closePrice?: number;
  entryDate: string;
  closeDate: string;
  realizedPnl: number;
  broker?: string;
  notes?: string;
  importedFrom?: string;
  importDate: string;
}

export const getClosedPositions = (): ClosedPosition[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CLOSED_POSITIONS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error parsing closed positions:', e);
    return [];
  }
};

export const saveClosedPosition = (position: ClosedPosition): void => {
  const positions = getClosedPositions();
  // Check if already exists (same id)
  const index = positions.findIndex(p => p.id === position.id);
  if (index >= 0) {
    positions[index] = position;
  } else {
    positions.push(position);
  }
  localStorage.setItem(CLOSED_POSITIONS_KEY, JSON.stringify(positions));
};

export const saveClosedPositions = (newPositions: ClosedPosition[]): void => {
  const existing = getClosedPositions();
  const merged = [...existing];
  for (const pos of newPositions) {
    const index = merged.findIndex(p => p.id === pos.id);
    if (index >= 0) {
      merged[index] = pos;
    } else {
      merged.push(pos);
    }
  }
  localStorage.setItem(CLOSED_POSITIONS_KEY, JSON.stringify(merged));
};

export const clearClosedPositions = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLOSED_POSITIONS_KEY);
};

export const exportClosedPositionsCSV = (): string => {
  const positions = getClosedPositions();
  if (positions.length === 0) return '';
  
  const headers = ['Ticker', 'Type', 'Side', 'Strike', 'Expiry', 'Qty', 'Entry Price', 'Close Price', 'Entry Date', 'Close Date', 'Realized P&L', 'Broker', 'Notes'];
  const rows = positions.map(p => [
    p.ticker,
    p.optionType,
    p.side,
    p.strike,
    p.expiry,
    p.quantity,
    p.entryPrice,
    p.closePrice || '',
    p.entryDate,
    p.closeDate,
    p.realizedPnl,
    p.broker || '',
    p.notes || ''
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

export const exportClosedPositionsJSON = (): string => {
  const positions = getClosedPositions();
  return JSON.stringify(positions, null, 2);
};
