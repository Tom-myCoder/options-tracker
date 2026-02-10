# Options Tracker - Improvement Roadmap

A living document tracking all planned features and improvements for the Options Tracker app.

---

## Priority Matrix

| Priority | Items |
|----------|-------|
| 🔴 High | Critical features for daily use |
| 🟡 Medium | Important enhancements |
| 🟢 Low | Nice-to-have features |

---

## Feature Requests & Improvements

### Data Entry & UX
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 1 | **Screenshot Auto-Import** | Share a screenshot from broker app → AI extracts ticker, strike, expiry, qty, price, side and auto-fills the form | 🔴 High | ⏳ Planned | Requires OCR + LLM parsing. Could use OpenAI Vision API or local OCR |
| 2 | **CSV/Excel Import** | Bulk import positions from spreadsheet export | 🟡 Medium | ⏳ Planned | Standardize column mapping |
| 3 | **Position Templates** | Save common strategies (e.g., "NVDA $150 Put 30 DTE") as templates for quick entry | 🟡 Medium | ⏳ Planned | |
| 4 | **Broker Auto-Detect** | Remember broker per ticker or auto-suggest based on past entries | 🟢 Low | ⏳ Planned | |
| 5 | **Duplicate Detection** | Warn if adding a position that already exists | 🟡 Medium | ⏳ Planned | |
| 6 | **Position Editing** | Allow editing existing positions (not just delete) | 🟡 Medium | ⏳ Planned | |

### Market Data & Pricing
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 7 | **Yahoo Finance Integration** | Pull live option prices and underlying stock prices | 🔴 High | ⏳ Planned | Free tier available. Need to handle rate limits |
| 8 | **Real-Time P&L** | Calculate unrealized P&L using live market data | 🔴 High | ⏳ Planned | Depends on #7 |
| 9 | **Greeks Display** | Show Delta, Gamma, Theta, Vega for each position | 🟡 Medium | ⏳ Planned | Can calculate from Black-Scholes or fetch from API |
| 10 | **IV Rank/Percentile** | Display implied volatility context | 🟡 Medium | ⏳ Planned | |
| 11 | **Price Alerts** | Notify when option reaches target price or P&L threshold | 🟡 Medium | ⏳ Planned | Could use browser notifications or Telegram |
| 12 | **Historical P&L Chart** | Track P&L over time for closed positions | 🟢 Low | ⏳ Planned | |

### Visualization & Analysis
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 13 | **Position Detail Modal** | Click a row to see full details + risk graph | 🔴 High | ⏳ Planned | Show profit/loss diagram |
| 14 | **Risk Graph / Payoff Chart** | Visualize max profit/loss, breakeven points | 🔴 High | ⏳ Planned | Key for deciding when to close |
| 15 | **Time Decay Visualization** | Show how Theta affects position value over time | 🟡 Medium | ⏳ Planned | |
| 16 | **Portfolio Heatmap** | Visual risk exposure by ticker/sector | 🟢 Low | ⏳ Planned | |
| 17 | **Correlation Matrix** | Show how positions correlate with each other | 🟢 Low | ⏳ Planned | |

### Position Management
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 18 | **Close Position Flow** | Record closing price, date, realized P&L → moves to "Closed Positions" | 🔴 High | ⏳ Planned | Separate view for closed trades |
| 19 | **Partial Close** | Close part of a position (e.g., 2 of 5 contracts) | 🟡 Medium | ⏳ Planned | |
| 20 | **Roll Position** | Record rolling to new strike/expiry as a linked sequence | 🟡 Medium | ⏳ Planned | Track adjustment history |
| 21 | **Assignment Tracking** | Record if put was assigned, cost basis of resulting shares | 🟡 Medium | ⏳ Planned | Important for Sell Put users |
| 22 | **Tax Lot Tracking** | Track holding periods for tax reporting | 🟢 Low | ⏳ Planned | Export 1099-style summary |

### Reporting & Export
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 23 | **Monthly/Yearly Summary** | Aggregate P&L by month/year | 🟡 Medium | ⏳ Planned | |
| 24 | **Tax Report Export** | Export closed trades for tax software | 🟢 Low | ⏳ Planned | CSV/Excel format |
| 25 | **Performance Metrics** | Win rate, avg profit/loss, max drawdown, Sharpe ratio | 🟡 Medium | ⏳ Planned | |
| 26 | **Strategy Tagging** | Tag positions by strategy (Wheel, CSP, CC, Spread, etc.) | 🟡 Medium | ⏳ Planned | Filter/summarize by strategy |

### Technical Improvements
| # | Feature | Description | Priority | Status | Notes |
|---|---------|-------------|----------|--------|-------|
| 27 | **Responsive Table** | Better use of large screens, collapsible columns on mobile | 🔴 High | ✅ Done | Wider on 2xl screens |
| 28 | **Auto-Fill Prevention** | Eliminate browser autofill leftovers after add | 🔴 High | ✅ Done | Form remount + unique names |
| 29 | **Dark Mode** | Toggle between light/dark themes | 🟢 Low | ⏳ Planned | |
| 30 | **Data Sync/Backup** | Export/import all data, cloud backup option | 🟡 Medium | ⏳ Planned | JSON export + optional cloud |
| 31 | **PWA Support** | Install as mobile app, work offline | 🟢 Low | ⏳ Planned | |
| 32 | **Multi-Account** | Track positions across multiple accounts separately | 🟡 Medium | ⏳ Planned | Account selector + aggregation |

---

## Screenshot Auto-Import - Technical Plan

This is the #1 requested feature. Here's how to implement:

### Option A: OpenAI Vision API (Recommended)
**Pros:** Accurate, handles various broker apps, fast  
**Cons:** Requires API key, small cost per image (~$0.01-0.02)

**Flow:**
1. User pastes or uploads screenshot
2. Send to GPT-4 Vision with prompt:
   ```
   Extract: Ticker, Option Type (Call/Put), Strike Price, 
   Expiry Date, Quantity, Entry Price, Side (Buy/Sell), Broker
   Return as JSON.
   ```
3. Parse JSON response
4. Pre-fill form fields
5. User reviews and confirms

### Option B: Local OCR (Tesseract.js)
**Pros:** Free, private, no API key  
**Cons:** Less accurate, requires clean screenshots

### Option C: Broker API Integration
**Pros:** Direct data, no manual entry  
**Cons:** Requires OAuth, each broker different (TD, Robinhood, etc.)

**Recommended approach:** Start with Option A (OpenAI Vision) for MVP, add Option C later for major brokers.

---

## Risk Graph / Payoff Chart - Technical Plan

Key feature for deciding when to close positions.

### What to Show:
- **X-axis:** Underlying stock price at expiry
- **Y-axis:** Profit/Loss
- **Lines:** Current P&L (solid), Expiry P&L (dashed)
- **Key points:** Max profit, Max loss, Breakeven(s), Current stock price

### Implementation:
1. Calculate payoff at various stock prices (e.g., +/- 30% of current)
2. For Sell Put: profit = premium received below strike
3. Use Chart.js or Recharts for rendering
4. Show time value decay overlay

---

## Next Steps

1. ✅ Fix autofill issue (DONE)
2. ✅ Wider table on large screens (DONE)  
3. 🔄 Implement Yahoo Finance price fetch
4. 🔄 Add Position Detail Modal with Risk Graph
5. 🔄 Build Screenshot Import feature

---

*Last updated: 2026-02-10*  
*Maintained by: Tom (AI Assistant)*
