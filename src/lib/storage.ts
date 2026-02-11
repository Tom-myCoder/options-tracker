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

// Export positions as CSV (simple header-based)
export const exportPositionsCSV = (): string => {
  const positions = getPositions();
  const header = ['id','ticker','optionType','side','strike','expiry','quantity','entryPrice','currentPrice','entryDate','notes','broker','lastPriceUpdate'];
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
      notes: get('notes') || undefined,
      broker: get('broker') || undefined,
      lastPriceUpdate: get('lastPriceUpdate') ? Number(get('lastPriceUpdate')) : undefined,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
};

// Export/Import JSON for backup
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
