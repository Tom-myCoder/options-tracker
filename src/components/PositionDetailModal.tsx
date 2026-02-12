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
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import PositionPriceHistoryChart from './PositionPriceHistoryChart';

interface PositionDetailModalProps {
  position: OptionPosition;
  onClose: () => void;
}

interface PayoffPoint {
  price: number;
  payoff: number;
  pnl: number;
}

export default function PositionDetailModal({ position, onClose }: PositionDetailModalProps) {
  const [simulatedPrice, setSimulatedPrice] = useState<number | null>(null);
  
  const { payoffData, breakEven, maxProfit, maxLoss, currentUnderlyingPrice } = useMemo(() => {
    // Generate price range around strike (±50% of strike, minimum $10 range)
    const range = Math.max(position.strike * 0.5, 50);
    const minPrice = Math.max(1, Math.round(position.strike - range));
    const maxPrice = Math.round(position.strike + range);
    const steps = 100;
    const stepSize = (maxPrice - minPrice) / steps;
    
    // Calculate payoff for each price point
    const data: PayoffPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const price = minPrice + i * stepSize;
      const payoff = calculatePayoff(position, price);
      const pnl = calculatePnL(position, price);
      data.push({ price: Math.round(price * 100) / 100, payoff, pnl });
    }
    
    // Find break-even points (where P&L = 0)
    const breakEvens: number[] = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i-1].pnl * data[i].pnl < 0) {
        // Linear interpolation
        const t = Math.abs(data[i-1].pnl) / (Math.abs(data[i-1].pnl) + Math.abs(data[i].pnl));
        const be = data[i-1].price + t * (data[i].price - data[i-1].price);
        breakEvens.push(Math.round(be * 100) / 100);
      }
    }
    
    // Max profit/loss (theoretical at extremes)
    const maxProfit = Math.max(...data.map(d => d.pnl));
    const maxLoss = Math.min(...data.map(d => d.pnl));
    
    // Estimate current underlying price from position data or use strike as fallback
    const currentUnderlyingPrice = position.currentPrice 
      ? estimateUnderlyingPrice(position)
      : position.strike;
    
    return {
      payoffData: data,
      breakEven: breakEvens,
      maxProfit,
      maxLoss,
      currentUnderlyingPrice,
    };
  }, [position]);
  
  // Current P&L based on current option price (if available)
  const currentPnL = useMemo(() => {
    if (position.currentPrice != null) {
      return calculatePnL(position, null, position.currentPrice);
    }
    return null;
  }, [position]);
  
  // Simulated P&L for the slider
  const simulatedPnL = useMemo(() => {
    if (simulatedPrice != null) {
      return calculatePnL(position, simulatedPrice);
    }
    return null;
  }, [simulatedPrice, position]);
  
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {position.ticker} {position.optionType.toUpperCase()} ${position.strike} {position.expiry}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {position.side === 'buy' ? 'Long' : 'Short'} {position.quantity} contract{position.quantity !== 1 ? 's' : ''}
              {position.broker && ` • ${position.broker}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        {/* Position Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50">
          <div>
            <p className="text-xs text-gray-600 uppercase">Entry Price</p>
            <p className="text-lg font-semibold">${position.entryPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase">Current Price</p>
            <p className="text-lg font-semibold">
              {position.currentPrice != null ? `$${position.currentPrice.toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase">Current P&L</p>
            <p className={`text-lg font-semibold ${currentPnL != null && currentPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currentPnL != null ? formatCurrency(currentPnL) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase">Max Risk/Reward</p>
            <p className="text-sm">
              <span className="text-red-600">{formatCurrencyNoSign(maxLoss)}</span>
              {' / '}
              <span className="text-green-600">{formatCurrencyNoSign(maxProfit)}</span>
            </p>
          </div>
        </div>
        
        {/* Chart */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payoff at Expiration</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={payoffData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => `$${v}`}
                  stroke="#6b7280"
                />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  stroke="#6b7280"
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'P&L']}
                  labelFormatter={(label) => `Underlying: $${label}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 2" />
                <ReferenceLine x={position.strike} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Strike', position: 'top', fill: '#6b7280', fontSize: 10 }} />
                
                {/* Break-even lines */}
                {breakEven.map((be, i) => (
                  <ReferenceLine
                    key={i}
                    x={be}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    label={{ value: `BE`, position: 'top', fill: '#10b981', fontSize: 10 }}
                  />
                ))}
                
                {/* Current underlying price dot */}
                {currentUnderlyingPrice && (
                  <ReferenceDot
                    x={currentUnderlyingPrice}
                    y={payoffData.find(d => d.price >= currentUnderlyingPrice)?.pnl || 0}
                    r={6}
                    fill="#3b82f6"
                    stroke="none"
                    label={{ value: 'Current', position: 'top', fill: '#3b82f6', fontSize: 10 }}
                  />
                )}
                
                {/* Simulated price dot */}
                {simulatedPrice && (
                  <ReferenceDot
                    x={simulatedPrice}
                    y={simulatedPnL || 0}
                    r={6}
                    fill="#f59e0b"
                    stroke="none"
                    label={{ value: 'Simulated', position: 'bottom', fill: '#f59e0b', fontSize: 10 }}
                  />
                )}
                
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Price Simulator */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Simulate Underlying Price</label>
              <span className="text-sm font-semibold text-amber-600">
                {simulatedPrice ? `$${simulatedPrice.toFixed(2)} (${simulatedPnL != null ? formatCurrency(simulatedPnL) : '—'})` : 'Drag slider'}
              </span>
            </div>
            <input
              type="range"
              min={Math.min(...payoffData.map(d => d.price))}
              max={Math.max(...payoffData.map(d => d.price))}
              step={0.01}
              value={simulatedPrice ?? currentUnderlyingPrice}
              onChange={(e) => setSimulatedPrice(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>${Math.min(...payoffData.map(d => d.price)).toFixed(2)}</span>
              <span>Strike: ${position.strike}</span>
              <span>${Math.max(...payoffData.map(d => d.price)).toFixed(2)}</span>
            </div>
          </div>
          
          {breakEven.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="font-medium">Break-even{breakEven.length > 1 ? 's' : ''}: </span>
              {breakEven.map(be => `$${be.toFixed(2)}`).join(', ')}
            </div>
          )}
          
          {position.notes && (
            <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Notes: </span>
                {position.notes}
              </p>
            </div>
          )}
          
          {/* Historical Price Chart with Theta Projection */}
          <div className="mt-6 pt-6 border-t">
            <PositionPriceHistoryChart position={position} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Calculate payoff at expiration (intrinsic value)
function calculatePayoff(position: OptionPosition, underlyingPrice: number): number {
  let intrinsicValue = 0;
  
  if (position.optionType === 'call') {
    intrinsicValue = Math.max(0, underlyingPrice - position.strike);
  } else {
    intrinsicValue = Math.max(0, position.strike - underlyingPrice);
  }
  
  const totalValue = intrinsicValue * position.quantity * 100;
  
  if (position.side === 'buy') {
    // Long: payoff is value - premium paid
    return totalValue - (position.entryPrice * position.quantity * 100);
  } else {
    // Short: payoff is premium received - value
    return (position.entryPrice * position.quantity * 100) - totalValue;
  }
}

// Calculate P&L based on current option price or estimated underlying
function calculatePnL(position: OptionPosition, underlyingPrice: number | null, currentOptionPrice?: number): number {
  if (currentOptionPrice != null) {
    // Use actual current option price
    const currentValue = currentOptionPrice * position.quantity * 100;
    const entryValue = position.entryPrice * position.quantity * 100;
    return position.side === 'buy' 
      ? currentValue - entryValue  // Long: current - entry
      : entryValue - currentValue; // Short: entry - current (because we received premium)
  }
  
  // Fall back to payoff calculation at expiration
  if (underlyingPrice != null) {
    return calculatePayoff(position, underlyingPrice);
  }
  
  return 0;
}

// Estimate underlying price from option price (rough approximation for visualization)
function estimateUnderlyingPrice(position: OptionPosition): number {
  // For ITM options, we can roughly estimate underlying from intrinsic value
  if (position.currentPrice != null) {
    if (position.optionType === 'call') {
      // Call: underlying ≈ strike + option price (if ITM)
      return position.strike + position.currentPrice;
    } else {
      // Put: underlying ≈ strike - option price (if ITM)
      return position.strike - position.currentPrice;
    }
  }
  return position.strike;
}
