'use client';

import { useState, useEffect, useRef } from 'react';
import AddPositionForm from '@/components/AddPositionForm';
import PositionsTable from '@/components/PositionsTable';
import PortfolioSummary from '@/components/PortfolioSummary';
import ScreenshotImport from '@/components/ScreenshotImport';
import { OptionPosition } from '@/types/options';
import { getPositions, savePosition } from '@/lib/storage';
import { useMarketData } from '@/hooks/useMarketData';

// Auto-refresh interval in milliseconds (15 minutes)
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000;
// Minimum time away to trigger catch-up refresh (5 minutes)
const CATCH_UP_THRESHOLD = 5 * 60 * 1000;

export default function Home() {
  const [positions, setPositions] = useState<OptionPosition[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingPosition, setEditingPosition] = useState<OptionPosition | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_INTERVAL);
  const [catchUpMessage, setCatchUpMessage] = useState<string | null>(null);
  const [showScreenshotImport, setShowScreenshotImport] = useState(false);
  const { fetchPrices, refreshPrices, isLoading, lastUpdated, error } = useMarketData();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibleRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(Date.now());

  // Initial load
  useEffect(() => {
    const loadedPositions = getPositions();
    setPositions(loadedPositions);
    
    // Auto-fetch prices on load if we have positions
    if (loadedPositions.length > 0) {
      fetchPrices(loadedPositions).then(updated => {
        setPositions(updated);
        lastRefreshRef.current = Date.now();
      });
    }
  }, []);

  // Re-load positions when refreshKey changes (after add/delete/edit)
  useEffect(() => {
    setPositions(getPositions());
  }, [refreshKey]);

  // Auto-refresh setup
  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    if (autoRefreshEnabled && positions.length > 0) {
      // Set up auto-refresh interval
      intervalRef.current = setInterval(() => {
        handlePriceRefresh();
        setNextRefreshIn(AUTO_REFRESH_INTERVAL);
      }, AUTO_REFRESH_INTERVAL);

      // Set up countdown timer
      countdownRef.current = setInterval(() => {
        setNextRefreshIn(prev => {
          if (prev <= 1000) {
            return AUTO_REFRESH_INTERVAL;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [autoRefreshEnabled, positions.length]);

  // Catch-up on wake - detect when user returns after device sleep
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeAway = now - lastVisibleRef.current;
        const timeSinceRefresh = now - lastRefreshRef.current;
        
        // If away for more than threshold AND we have positions
        if (timeAway > CATCH_UP_THRESHOLD && positions.length > 0 && autoRefreshEnabled) {
          // Calculate how many refreshes were missed
          const missedRefreshes = Math.floor(timeSinceRefresh / AUTO_REFRESH_INTERVAL);
          
          if (missedRefreshes > 0 || timeSinceRefresh > AUTO_REFRESH_INTERVAL) {
            // Trigger catch-up refresh
            setCatchUpMessage(`Welcome back! Catching up on ${Math.floor(timeAway / 60000)} minutes of missed data...`);
            handlePriceRefresh().then(() => {
              // Clear message after 3 seconds
              setTimeout(() => setCatchUpMessage(null), 3000);
            });
          }
        }
        
        lastVisibleRef.current = now;
      } else {
        // Tab hidden - record the time
        lastVisibleRef.current = Date.now();
      }
    };

    // Also handle focus event for desktop browsers
    const handleFocus = () => {
      const now = Date.now();
      const timeAway = now - lastVisibleRef.current;
      const timeSinceRefresh = now - lastRefreshRef.current;
      
      if (timeAway > CATCH_UP_THRESHOLD && positions.length > 0 && autoRefreshEnabled) {
        if (timeSinceRefresh > AUTO_REFRESH_INTERVAL) {
          setCatchUpMessage(`Welcome back! Catching up...`);
          handlePriceRefresh().then(() => {
            setTimeout(() => setCatchUpMessage(null), 3000);
          });
        }
      }
      lastVisibleRef.current = now;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [positions.length, autoRefreshEnabled]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setEditingPosition(null);
  };

  const handlePriceRefresh = async () => {
    const updated = await refreshPrices();
    setPositions(updated);
    setNextRefreshIn(AUTO_REFRESH_INTERVAL);
    lastRefreshRef.current = Date.now();
  };

  const handleEdit = (position: OptionPosition) => {
    setEditingPosition(position);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
  };

  const handleScreenshotImport = (positions: OptionPosition[]) => {
    // Save all imported positions
    positions.forEach(position => {
      savePosition(position);
    });
    setShowScreenshotImport(false);
    handleRefresh();
  };

  // Format countdown time
  const formatCountdown = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Options Tracker</h1>
              <p className="text-xs sm:text-sm text-gray-500">Track your options portfolio</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              {/* Catch-up message */}
              {catchUpMessage && (
                <span className="text-xs text-blue-600 animate-pulse w-full sm:w-auto text-right">
                  {catchUpMessage}
                </span>
              )}
              
              {/* Auto-refresh indicator */}
              {positions.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      autoRefreshEnabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    title={autoRefreshEnabled ? 'Click to pause auto-refresh' : 'Click to enable auto-refresh'}
                  >
                    <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className="hidden sm:inline">{autoRefreshEnabled ? 'Auto' : 'Paused'}</span>
                  </button>
                  {autoRefreshEnabled && !isLoading && !catchUpMessage && (
                    <span className="text-gray-400 hidden sm:inline">
                      Next: {formatCountdown(nextRefreshIn)}
                    </span>
                  )}
                </div>
              )}
              
              {lastUpdated && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              {error && (
                <span className="text-xs text-red-500 hidden sm:inline">{error}</span>
              )}
              <button
                onClick={() => setShowScreenshotImport(true)}
                className="px-3 sm:px-4 py-2 bg-purple-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-purple-700 flex items-center gap-1 sm:gap-2"
                title="Import from Screenshot"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Import Screenshot</span>
                <span className="sm:hidden">Import</span>
              </button>
              <button
                onClick={handlePriceRefresh}
                disabled={isLoading}
                className="px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                title="Refresh Prices"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.000 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">Refresh Prices</span>
                    <span className="sm:hidden">Refresh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-full 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        {/* Summary Cards */}
        <PortfolioSummary positions={positions} />

        {/* Add/Edit Position Form */}
        <AddPositionForm 
          onAdd={handleRefresh} 
          editPosition={editingPosition}
          onCancelEdit={handleCancelEdit}
        />

        {/* Positions Table */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Positions</h2>
          <PositionsTable 
            positions={positions} 
            onDelete={handleRefresh}
            onEdit={handleEdit}
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Options Tracker v1.0 • Built with Next.js</p>
          <p className="mt-1">Data stored locally in your browser</p>
          {positions.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Auto-refresh: {autoRefreshEnabled ? 'Enabled (every 15 min + catch-up on wake)' : 'Paused'}
            </p>
          )}
        </footer>
      </div>

      {/* Screenshot Import Modal */}
      {showScreenshotImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <ScreenshotImport
            onImport={handleScreenshotImport}
            onCancel={() => setShowScreenshotImport(false)}
          />
        </div>
      )}
    </main>
  );
}
