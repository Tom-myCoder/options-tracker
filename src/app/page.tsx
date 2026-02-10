'use client';

import { useState, useEffect } from 'react';
import AddPositionForm from '@/components/AddPositionForm';
import PositionsTable from '@/components/PositionsTable';
import PortfolioSummary from '@/components/PortfolioSummary';
import { OptionPosition } from '@/types/options';
import { getPositions } from '@/lib/storage';

export default function Home() {
  const [positions, setPositions] = useState<OptionPosition[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPositions(getPositions());
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Options Tracker</h1>
            <p className="text-sm text-gray-500">Track your options portfolio</p>
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
