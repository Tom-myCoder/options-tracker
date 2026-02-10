'use client';

import { useState, useEffect } from 'react';
import AddPositionForm from '@/components/AddPositionForm';
import PositionsTable from '@/components/PositionsTable';
import PortfolioSummary from '@/components/PortfolioSummary';
import { OptionPosition } from '@/types/options';
import { getPositions } from '@/lib/storage';
import { useMarketData } from '@/hooks/useMarketData';

export default function Home() {
  const [positions, setPositions] = useState<OptionPosition[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetchPrices, refreshPrices, isLoading, lastUpdated, error } = useMarketData();

  useEffect(() => {
    const loadedPositions = getPositions();
    setPositions(loadedPositions);
    
    // Auto-fetch prices on load if we have positions
    if (loadedPositions.length > 0) {
      fetchPrices(loadedPositions).then(updated => {
        setPositions(updated);
      });
    }
  }, []);

  // Re-load positions when refreshKey changes (after add/delete)
  useEffect(() => {
    setPositions(getPositions());
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handlePriceRefresh = async () => {
    const updated = await refreshPrices();
    setPositions(updated);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Options Tracker</h1>
              <p className="text-sm text-gray-500">Track your options portfolio</p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-gray-500">
                  Prices updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              {error && (
                <span className="text-xs text-red-500">{error}</span>
              )}
              <button
                onClick={handlePriceRefresh}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Prices
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <PortfolioSummary positions={positions} />

        {/* Add Position Form */}
        <AddPositionForm onAdd={handleRefresh} />

        {/* Positions Table */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Positions</h2>
          <PositionsTable positions={positions} onDelete={handleRefresh} />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Options Tracker v1.0 • Built with Next.js</p>
          <p className="mt-1">Data stored locally in your browser</p>
        </footer>
      </div>
    </main>
  );
}
