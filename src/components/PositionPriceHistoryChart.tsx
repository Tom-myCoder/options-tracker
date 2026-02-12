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
  const { data, yDomain, stats } = useMemo(() => {
    const history = position.priceHistory || [];
    const entryTime = new Date(position.entryDate).getTime();
    const expiryTime = new Date(position.expiry).getTime();
    const now = Date.now();
    
    // Build historical data points
    const historicalPoints: ChartPoint[] = history.map(h => {
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
    
    // Add entry point if not in history
    if (historicalPoints.length === 0 || historicalPoints[0].timestamp > entryTime) {
      historicalPoints.unshift({
        date: new Date(position.entryDate).toLocaleDateString(),
        timestamp: entryTime,
        price: position.entryPrice,
        underlyingPrice: undefined,
        pnl: 0,
        projected: false,
      });
    }
    
    // Calculate Theta decay projection
    const projectedPoints: ChartPoint[] = [];
    const daysToExpiry = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));
    
    if (daysToExpiry > 0 && position.currentPrice != null) {
      // Estimate daily theta (simplified assumption: linear decay to intrinsic value at expiry)
      // This is a rough approximation - real theta is non-linear
      const currentPrice = position.currentPrice;
      const intrinsicValueAtExpiry = 0; // At expiry, time value = 0, only intrinsic remains
      const timeValue = currentPrice - calculateIntrinsicValue(position, position.currentPrice);
      const dailyThetaDecay = timeValue / daysToExpiry;
      
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
    
    // Combine historical and projected
    const allData = [...historicalPoints, ...projectedPoints];
    
    // Calculate stats
    const currentPnL = position.currentPrice != null
      ? (position.side === 'buy'
          ? (position.currentPrice - position.entryPrice) * position.quantity * 100
          : (position.entryPrice - position.currentPrice) * position.quantity * 100)
      : 0;
    
    // Calculate proper Y-axis domain with padding to ensure nothing is clipped
    const allPrices = allData.map(d => d.price);
    const minDataPrice = allPrices.length > 0 ? Math.min(...allPrices) : position.entryPrice;
    const maxDataPrice = allPrices.length > 0 ? Math.max(...allPrices) : position.entryPrice;
    const priceRange = maxDataPrice - minDataPrice;
    const padding = priceRange > 0 ? priceRange * 0.15 : position.entryPrice * 0.1;
    const minPrice = Math.max(0, minDataPrice - padding);
    const maxPrice = maxDataPrice + padding;
    
    return {
      data: allData,
      yDomain: [minPrice, maxPrice],
      stats: {
        currentPnL,
        daysHeld: Math.ceil((now - entryTime) / (1000 * 60 * 60 * 24)),
        daysToExpiry: Math.max(0, daysToExpiry),
        maxDrawdown: calculateMaxDrawdown(historicalPoints, position),
        bestPrice: historicalPoints.length > 0 ? Math.max(...historicalPoints.map(h => h.price)) : position.entryPrice,
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
          <p className="text-gray-500 text-xs">Best Price Seen</p>
          <p className="font-semibold text-green-600">${stats.bestPrice.toFixed(2)}</p>
        </div>
      </div>
      
      {/* Price Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Option Price History & Theta Projection</h4>
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
                        {point.underlyingPrice && (
                          <p className="text-blue-600 text-xs">
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
              
              {/* Historical price line */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name="Historical"
              />
              
              {/* Projected theta decay (dashed) */}
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
          Solid line = actual prices • Dashed line = projected theta decay to expiry
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

function calculateIntrinsicValue(position: OptionPosition, optionPrice: number): number {
  // We need underlying price to calculate true intrinsic value
  // For projection purposes, we approximate based on current option price
  // ATM options have ~0 intrinsic, ITM have intrinsic = option price - time value
  // This is a simplification
  return 0;
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
