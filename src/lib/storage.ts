import { OptionPosition } from '@/types/options';

const STORAGE_KEY = 'options-tracker-positions';

export const getPositions = (): OptionPosition[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const savePosition = (position: OptionPosition): void => {
  const positions = getPositions();
  positions.push(position);
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

// Export positions as CSV (simple header-based)
export const exportPositionsCSV = (): string => {
  const positions = getPositions();
  const header = ['id','ticker','optionType','side','strike','expiry','quantity','entryPrice','currentPrice','entryDate','purchaseDate','notes','broker','lastPriceUpdate'];
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
    p.lastPriceUpdate ? String(p.lastPriceUpdate) : ''
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

// Import CSV (overwrites stored positions) - simple parser, expects same header
export const importPositionsCSV = (csvText: string): void => {
  if (typeof window === 'undefined') return;
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return;
  
  // Parse header line
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  
  const positions: OptionPosition[] = lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const get = (name: string) => {
      const idx = header.indexOf(name);
      return idx >= 0 && idx < cols.length ? cols[idx] : '';
    };
    return {
      id: get('id') || generateId(),
      ticker: get('ticker') || '',
      optionType: (get('optionType') as 'call' | 'put') || 'call',
      side: (get('side') as 'buy' | 'sell') || 'buy',
      strike: parseFloat(get('strike') || '0') || 0,
      expiry: get('expiry') || '',
      quantity: parseInt(get('quantity') || '0') || 0,
      entryPrice: parseFloat(get('entryPrice') || '0') || 0,
      currentPrice: get('currentPrice') ? parseFloat(get('currentPrice')) : undefined,
      entryDate: get('entryDate') || new Date().toISOString().split('T')[0],
      purchaseDate: get('purchaseDate') || undefined,
      notes: get('notes') || undefined,
      broker: get('broker') || undefined,
      lastPriceUpdate: get('lastPriceUpdate') ? Number(get('lastPriceUpdate')) : undefined,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

// Export/Import JSON for backup (includes full price history)
export const exportPositionsJSON = (): string => JSON.stringify(getPositions(), null, 2);
export const importPositionsJSON = (jsonText: string): void => {
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Invalid JSON');
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
