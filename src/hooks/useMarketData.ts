'use client';

import { useState, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { getPositions, addPriceSnapshot } from '@/lib/storage';

interface PriceData {
  symbol: string;
  price: number;
  optionPrice?: number;
  expiry?: string;
  strike?: number;
  type?: string;
  timestamp: number;
}

export function useMarketData() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async (positions: OptionPosition[]): Promise<OptionPosition[]> => {
    if (positions.length === 0) return positions;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get unique tickers
      const tickers = [...new Set(positions.map(p => p.ticker))];
      
      // Fetch underlying prices for each ticker
      const underlyingMap = new Map<string, number>();
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const response = await fetch(`/api/price?ticker=${ticker}`);
            if (response.ok) {
              const data = await response.json();
              underlyingMap.set(ticker, data.price);
            }
          } catch (err) {
            console.error(`Failed to fetch price for ${ticker}:`, err);
          }
        })
      );
      
      // Fetch option-specific prices and add snapshots
      await Promise.all(
        positions.map(async (position) => {
          try {
            const url = `/api/option-price?ticker=${position.ticker}&expiry=${position.expiry}&strike=${position.strike}&type=${position.optionType}`;
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (data.optionPrice) {
                // Add price snapshot with underlying price if available
                const underlyingPrice = underlyingMap.get(position.ticker);
                addPriceSnapshot(position.id, data.optionPrice, underlyingPrice);
              }
            }
          } catch (err) {
            console.error(`[MarketData] Error fetching option for ${position.ticker}:`, err);
          }
        })
      );
      
      // Reload positions with updated history
      const updatedPositions = getPositions();
      setLastUpdated(new Date());
      
      return updatedPositions;
    } catch (err) {
      setError('Failed to fetch market data');
      return positions;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    const positions = getPositions();
    return fetchPrices(positions);
  }, [fetchPrices]);

  return {
    fetchPrices,
    refreshPrices,
    isLoading,
    lastUpdated,
    error,
  };
}
