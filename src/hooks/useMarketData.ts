'use client';

import { useState, useCallback } from 'react';
import { OptionPosition } from '@/types/options';
import { getPositions, updatePositions } from '@/lib/storage';

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
      
      // Fetch prices for each ticker
      const priceMap = new Map<string, PriceData>();
      
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const response = await fetch(`/api/price?ticker=${ticker}`);
            if (response.ok) {
              const data = await response.json();
              priceMap.set(ticker, data);
            }
          } catch (err) {
            console.error(`Failed to fetch price for ${ticker}:`, err);
          }
        })
      );
      
      // Also fetch option-specific prices for more accuracy
      await Promise.all(
        positions.map(async (position) => {
          try {
            const response = await fetch(
              `/api/option-price?ticker=${position.ticker}&expiry=${position.expiry}&strike=${position.strike}&type=${position.optionType}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.optionPrice) {
                // Store with a unique key for this specific option
                const key = `${position.ticker}-${position.expiry}-${position.strike}-${position.optionType}`;
                priceMap.set(key, data);
              }
            }
          } catch (err) {
            // Silently fail for individual options
          }
        })
      );
      
      // Update positions with fetched prices
      const updatedPositions = positions.map(position => {
        const optionKey = `${position.ticker}-${position.expiry}-${position.strike}-${position.optionType}`;
        const optionData = priceMap.get(optionKey);
        
        if (optionData && optionData.optionPrice) {
          return {
            ...position,
            currentPrice: optionData.optionPrice,
            lastPriceUpdate: Date.now(),
          };
        }
        
        return position;
      });
      
      // Save updated positions
      updatePositions(updatedPositions);
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
