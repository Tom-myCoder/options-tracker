'use client';

import { useMemo, useState } from 'react';
import { OptionPosition } from '@/types/options';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

interface MultiPositionChartProps {
  positions: OptionPosition[];
}

type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
type ViewMode = 'absolute' | 'normalized';

interface ChartPoint {
  date: string;
  timestamp: number;
  [key: string]: number | string;
}

export default function MultiPositionChart({ positions }: MultiPositionChartProps) {
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>(
    positions.slice(0, 3).map(p => p.id) // Default select first 3
  );
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1M');
  const [viewMode, setViewMode] = useState<ViewMode>('normalized');

  const selectedPositions = useMemo(() => {
    return positions.filter(p => selectedPositionIds.includes(p.id));
  }, [positions, selectedPositionIds]);

  const { chartData, yDomain } = useMemo(() => {
    if (selectedPositions.length === 0) {
      return { chartData: [], yDomain: [0, 100] };
    }

    // Calculate cutoff based on time frame
    const now = Date.now();
    const cutoffs: Record<TimeFrame, number> = {
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0,
    };
    const timeFrameCutoff = cutoffs[timeFrame];

    // Collect all timestamps from all positions
    // Only include data from entry date onwards (we can't track prices before position was opened)
    const allTimestamps = new Set<number>();
    selectedPositions.forEach(pos => {
      const entryTime = pos.purchaseDate 
        ? new Date(pos.purchaseDate).getTime()
        : new Date(pos.entryDate).getTime();
      
      // Only add timestamps from entry date onwards, and within the selected time frame
      pos.priceHistory?.forEach(h => {
        if (h.timestamp >= entryTime && h.timestamp >= timeFrameCutoff) {
          allTimestamps.add(h.timestamp);
        }
      });
      
      // Always add entry point if within time frame
      if (entryTime >= timeFrameCutoff) {
        allTimestamps.add(entryTime);
      }
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build chart data points
    const data: ChartPoint[] = sortedTimestamps.map(ts => {
      const point: ChartPoint = {
        date: new Date(ts).toLocaleDateString(),
        timestamp: ts,
      };

      selectedPositions.forEach(pos => {
        const key = `${pos.ticker}-${pos.strike}-${pos.optionType}`;
        
        const entryTime = pos.purchaseDate 
          ? new Date(pos.purchaseDate).getTime()
          : new Date(pos.entryDate).getTime();
        
        // Skip if this timestamp is before position entry date
        if (ts < entryTime - 24 * 60 * 60 * 1000) {
          return; // Don't include this position in this data point
        }
        
        // Find price at this timestamp
        const historyEntry = pos.priceHistory?.find(h => 
          Math.abs(h.timestamp - ts) < 24 * 60 * 60 * 1000 // Within 1 day
        );
        
        let value: number;
        if (historyEntry) {
          value = historyEntry.price;
        } else if (ts <= entryTime + 24 * 60 * 60 * 1000) {
          // At or near entry, use entry price
          value = pos.entryPrice;
        } else {
          // No data for this timestamp, use last known price
          const priorHistory = pos.priceHistory?.filter(h => h.timestamp <= ts);
          value = priorHistory && priorHistory.length > 0 
            ? priorHistory[priorHistory.length - 1].price
            : pos.entryPrice;
        }

        // Calculate based on view mode
        if (viewMode === 'normalized') {
          // Percentage change from entry
          const changePct = ((value - pos.entryPrice) / pos.entryPrice) * 100;
          // For sell positions, invert (price up = bad)
          point[key] = pos.side === 'sell' ? -changePct : changePct;
        } else {
          // Absolute price
          point[key] = value;
        }
      });

      return point;
    });

    // Calculate Y domain
    const allValues: number[] = [];
    data.forEach(point => {
      selectedPositions.forEach(pos => {
        const key = `${pos.ticker}-${pos.strike}-${pos.optionType}`;
        const value = point[key];
        if (typeof value === 'number') {
          allValues.push(value);
        }
      });
    });

    if (allValues.length === 0) {
      return { chartData: data, yDomain: viewMode === 'normalized' ? [-50, 50] : [0, 10] };
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;

    return {
      chartData: data,
      yDomain: [min - padding, max + padding],
    };
  }, [selectedPositions, timeFrame, viewMode]);

  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

  const togglePosition = (id: string) => {
    setSelectedPositionIds(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const formatYAxis = (value: number) => {
    if (viewMode === 'normalized') {
      return `${value.toFixed(1)}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatTooltip = (value: number) => {
    if (viewMode === 'normalized') {
      return [`${value.toFixed(2)}%`, 'Change from Entry'];
    }
    return [`$${value.toFixed(2)}`, 'Price'];
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        {/* Position Selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Select Positions to Compare (max 6)
          </label>
          <div className="flex flex-wrap gap-2">
            {positions.map(pos => (
              <button
                key={pos.id}
                onClick={() => togglePosition(pos.id)}
                disabled={!selectedPositionIds.includes(pos.id) && selectedPositionIds.length >= 6}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedPositionIds.includes(pos.id)
                    ? 'bg-blue-600 text-white'
                    : selectedPositionIds.length >= 6
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pos.ticker} ${pos.strike} {pos.optionType.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Time Frame & View Mode */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Time Frame</label>
            <div className="flex gap-1">
              {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as TimeFrame[]).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    timeFrame === tf
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">View Mode</label>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('normalized')}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === 'normalized'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                % Change
              </button>
              <button
                onClick={() => setViewMode('absolute')}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === 'absolute'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Price ($)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={50}
                stroke="#6b7280"
              />
              <YAxis
                domain={yDomain}
                tickFormatter={formatYAxis}
                stroke="#6b7280"
              />
              <Tooltip
                formatter={(value) => formatTooltip(Number(value))}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              />
              <Legend />
              
              {viewMode === 'normalized' && (
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              )}

              {selectedPositions.map((pos, idx) => {
                const key = `${pos.ticker}-${pos.strike}-${pos.optionType}`;
                return (
                  <Line
                    key={pos.id}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name={`${pos.ticker} $${pos.strike} ${pos.optionType.toUpperCase()}`}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 w-full flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {selectedPositions.length === 0 
              ? 'Select positions to compare' 
              : 'No price history available for selected time frame'}
          </p>
        </div>
      )}

      {/* Legend / Info */}
      <div className="text-xs text-gray-500">
        {viewMode === 'normalized' ? (
          <p>
            <strong>Normalized view:</strong> Shows % change from entry price. 
            For sell positions, the sign is inverted (positive = profit).
          </p>
        ) : (
          <p>
            <strong>Absolute view:</strong> Shows actual option prices over time.
          </p>
        )}
      </div>
    </div>
  );
}
