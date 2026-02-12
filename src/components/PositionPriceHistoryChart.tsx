'use client';

import { useMemo } from 'react';
import { OptionPosition } from '@/types/options';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
} from 'recharts';

interface PositionPriceHistoryChartProps {
  position: OptionPosition;
}

interface ChartPoint {
  date: string;
  timestamp: number;
  price: number;
  underlyingPrice?: number;
  pnl: number;
  projected?: boolean;
  thetaDecay?: number;
}

export default function PositionPriceHistoryChart({ position }: PositionPriceHistoryChartProps) {
  const { data, yDomain, stats, hasHistoricalData } = useMemo(() => {
    const history = position.priceHistory || [];
    const entryTime = new Date(position.entryDate).getTime();
    const expiryTime = new Date(position.expiry).getTime();
    const now = Date.now();
    
    // Filter out future-dated historical entries (shouldn't happen but just in case)
    const validHistory = history.filter(h => h.timestamp <= now + 24 * 60 * 60 * 1000);
    
    // Build historical data points
    const historicalPoints: ChartPoint[] = validHistory.map(h => {
      const date = new Date(h.timestamp);
      const pnl = position.side === 'buy'
        ? (h.price - position.entryPrice) * position.quantity * 100
        : (position.entryPrice - h.price) * position.quantity * 100;
      return {
        date: date.toLocaleDateString(),
        timestamp: h.timestamp,
        price: h.price,
        underlyingPrice: h.underlyingPrice,
        pnl,
        projected: false,
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
    
    // Add entry point if not in history and we have purchase date
    const purchaseTime = position.purchaseDate 
      ? new Date(position.purchaseDate).getTime()
      : entryTime;
    
    // Always add the entry/purchase point as the starting point
    const earliestPoint = historicalPoints.length > 0 
      ? historicalPoints[0] 
      : null;
      
    if (!earliestPoint || earliestPoint.timestamp > purchaseTime) {
      historicalPoints.unshift({
        date: new Date(purchaseTime).toLocaleDateString(),
        timestamp: purchaseTime,
        price: position.entryPrice,
        underlyingPrice: undefined,
        pnl: 0,
        projected: false,
      });
    }
    
    // Add current point if not already in history
    if (position.currentPrice != null) {
      const hasCurrentPoint = historicalPoints.some(
        h => Math.abs(h.timestamp - now) < 24 * 60 * 60 * 1000
      );
      if (!hasCurrentPoint) {
        const currentPnl = position.side === 'buy'
          ? (position.currentPrice - position.entryPrice) * position.quantity * 100
          : (position.entryPrice - position.currentPrice) * position.quantity * 100;
        historicalPoints.push({
          date: new Date().toLocaleDateString(),
          timestamp: now,
          price: position.currentPrice,
          underlyingPrice: undefined,
          pnl: currentPnl,
          projected: false,
        });
      }
    }
    
    // Re-sort after adding points
    historicalPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate Theta decay projection (only future dates)
    const projectedPoints: ChartPoint[] = [];
    const daysToExpiry = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));
    
    if (daysToExpiry > 0 && position.currentPrice != null) {
      const currentPrice = position.currentPrice;
      const timeValue = Math.max(0, currentPrice - getIntrinsicValue(position));
      const dailyThetaDecay = timeValue / Math.max(1, daysToExpiry);
      
      for (let day = 1; day <= Math.min(daysToExpiry, 30); day++) {
        const projectedDate = new Date(now + day * 24 * 60 * 60 * 1000);
        const projectedPrice = Math.max(0.01, currentPrice - (dailyThetaDecay * day));
        const projectedPnl = position.side === 'buy'
          ? (projectedPrice - position.entryPrice) * position.quantity * 100
          : (position.entryPrice - projectedPrice) * position.quantity * 100;
        
        projectedPoints.push({
          date: projectedDate.toLocaleDateString(),
          timestamp: projectedDate.getTime(),
          price: projectedPrice,
          underlyingPrice: undefined,
          pnl: projectedPnl,
          projected: true,
          thetaDecay: dailyThetaDecay * position.quantity * 100,
        });
      }
    }
    
    // Combine historical and projected - keep them separate for different line styles
    const allData = [...historicalPoints, ...projectedPoints];
    
    // Calculate stats
    const currentPnL = position.currentPrice != null
      ? (position.side === 'buy'
          ? (position.currentPrice - position.entryPrice) * position.quantity * 100
          : (position.entryPrice - position.currentPrice) * position.quantity * 100)
      : 0;
    
    // Calculate proper Y-axis domain with padding
    const allPrices = allData.map(d => d.price);
    const minDataPrice = allPrices.length > 0 ? Math.min(...allPrices) : position.entryPrice;
    const maxDataPrice = allPrices.length > 0 ? Math.max(...allPrices) : position.entryPrice;
    const priceRange = maxDataPrice - minDataPrice;
    const padding = priceRange > 0 ? priceRange * 0.15 : position.entryPrice * 0.1;
    const minPrice = Math.max(0, minDataPrice - padding);
    const maxPrice = maxDataPrice + padding;
    
    return {
      data: allData,
      historicalData: historicalPoints,
      projectedData: projectedPoints,
      yDomain: [minPrice, maxPrice],
      hasHistoricalData: historicalPoints.length > 1, // More than just entry point
      stats: {
        currentPnL,
        daysHeld: Math.ceil((now - purchaseTime) / (1000 * 60 * 60 * 24)),
        daysToExpiry: Math.max(0, daysToExpiry),
        maxDrawdown: calculateMaxDrawdown(historicalPoints, position),
        bestPrice: historicalPoints.length > 0 ? Math.max(...historicalPoints.map(h => h.price)) : position.entryPrice,
        dataPoints: historicalPoints.length,
        dateRange: historicalPoints.length > 0 
          ? `${new Date(historicalPoints[0].timestamp).toLocaleDateString()} - ${new Date(historicalPoints[historicalPoints.length - 1].timestamp).toLocaleDateString()}`
          : 'N/A',
      },
    };
  }, [position]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'always',
    }).format(value);
  };
  
  const formatCurrencyNoSign = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(value));
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-gray-500 text-xs">Current P&L</p>
          <p className={`font-semibold ${stats.currentPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.currentPnL)}
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-gray-500 text-xs">Days Held</p>
          <p className="font-semibold">{stats.daysHeld}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-gray-500 text-xs">Days to Expiry</p>
          <p className={`font-semibold ${stats.daysToExpiry < 7 ? 'text-red-600' : stats.daysToExpiry < 30 ? 'text-yellow-600' : ''}`}>
            {stats.daysToExpiry}
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-gray-500 text-xs">Data Points</p>
          <p className="font-semibold">{stats.dataPoints}</p>
          <p className="text-xs text-gray-400">{stats.dateRange}</p>
        </div>
      </div>
      
      {/* Price Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Option Price History & Theta Projection</h4>
        
        {!hasHistoricalData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Limited historical data. Click "Fetch History" above to load prices from purchase date.
            </p>
          </div>
        )}
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                stroke="#6b7280"
                allowDecimals={true}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload as ChartPoint;
                    return (
                      <div className="bg-white p-3 border rounded shadow text-sm">
                        <p className="font-medium">{point.date}</p>
                        <p className="text-gray-600">Price: ${point.price.toFixed(2)}</p>
                        <p className={point.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          P&L: {formatCurrency(point.pnl)}
                        </p>
                        {point.projected && (
                          <p className="text-amber-600 text-xs mt-1">Projected (Theta)</p>
                        )}
                        {!point.projected && point.timestamp <= Date.now() && (
                          <p className="text-blue-600 text-xs mt-1">Historical</p>
                        )}
                        {point.underlyingPrice && (
                          <p className="text-gray-500 text-xs">
                            Underlying: ${point.underlyingPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* Entry price line */}
              <ReferenceLine
                y={position.entryPrice}
                stroke="#374151"
                strokeDasharray="5 5"
                label={{ value: `Entry: $${position.entryPrice.toFixed(2)}`, position: 'right', fill: '#374151', fontSize: 10 }}
              />
              
              {/* Historical price line - solid blue */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name="Historical"
                data={data.filter(d => !d.projected)}
              />
              
              {/* Projected theta decay - dashed orange */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
                name="Projected"
                data={data.filter(d => d.projected)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Solid blue line = actual/historical prices • Dashed orange line = projected theta decay to expiry
        </p>
      </div>
      
      {/* Decision Helper */}
      {stats.daysToExpiry <= 7 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <p className="text-sm font-medium text-amber-800">⚠️ Expiring Soon</p>
          <p className="text-xs text-amber-700 mt-1">
            {stats.currentPnL > 0 
              ? "Consider taking profits or rolling to avoid time decay acceleration."
              : stats.currentPnL < -position.entryPrice * position.quantity * 100 * 0.5
                ? "Position is significantly underwater. Consider closing for loss or rolling out."
                : "Monitor closely. Theta decay will accelerate in final days."}
          </p>
        </div>
      )}
    </div>
  );
}

function getIntrinsicValue(position: OptionPosition): number {
  // Estimate intrinsic value based on option type
  // For puts: max(0, strike - underlying)
  // For calls: max(0, underlying - strike)
  // We approximate using current price as proxy
  if (!position.currentPrice) return 0;
  
  // Rough estimate: if option price < 0.5 * strike, likely OTM
  // This is a simplification for theta calculation
  if (position.optionType === 'call') {
    // Assume ATM if we don't have underlying
    return 0;
  } else {
    return 0;
  }
}

function calculateMaxDrawdown(history: ChartPoint[], position: OptionPosition): number {
  if (history.length < 2) return 0;
  
  let maxPnL = 0;
  let maxDrawdown = 0;
  
  for (const point of history) {
    if (point.pnl > maxPnL) {
      maxPnL = point.pnl;
    }
    const drawdown = maxPnL - point.pnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}
