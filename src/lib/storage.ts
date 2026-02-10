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
