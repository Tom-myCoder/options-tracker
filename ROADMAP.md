# Options Tracker - Roadmap

A living document tracking features, improvements, and future plans for the Options Tracker app.

**Live URL:** https://options.ai-capex.com  
**Repo:** https://github.com/Tom-myCoder/options-tracker

---

## ✅ Completed Features

### Core Functionality
| Feature | Description | Completed |
|---------|-------------|-----------|
| **Position Management** | Add, edit, delete option positions with full details (ticker, type, strike, expiry, qty, entry price, broker, notes) | ✅ Feb 2026 |
| **Purchase Date Tracking** | Optional purchase date separate from entry tracking date | ✅ Feb 2026 |
| **Multi-Broker Support** | Track positions by broker (TD, Schwab, Robinhood, etc.) | ✅ Feb 2026 |
| **Local Storage** | All data persists in browser localStorage | ✅ Feb 2026 |
| **CSV/JSON Export/Import** | Backup and restore positions with full price history | ✅ Feb 2026 |
| **Backward Compatibility** | Data versioning ensures old exports can be imported after app updates | ✅ Feb 2026 |

### Market Data & Pricing
| Feature | Description | Completed |
|---------|-------------|-----------|
| **Yahoo Finance Integration** | Live option prices and underlying stock prices | ✅ Feb 2026 |
| **Real-Time P&L** | Unrealized P&L calculation using live market data | ✅ Feb 2026 |
| **Auto-Refresh** | Automatic price updates every 15 minutes | ✅ Feb 2026 |
| **Catch-Up on Wake** | Detects when you return after device sleep and refreshes prices | ✅ Feb 2026 |
| **Price History Tracking** | Historical price snapshots with Theta decay projections | ✅ Feb 2026 |

### Visualization & Analysis
| Feature | Description | Completed |
|---------|-------------|-----------|
| **Position Detail Modal** | Click any position to see full details | ✅ Feb 2026 |
| **Risk Graph / Payoff Chart** | Visual P&L curve with break-even analysis and price simulation slider | ✅ Feb 2026 |
| **Historical Price Chart** | Track option price history from purchase date with Theta projection | ✅ Feb 2026 |
| **Portfolio Summary Cards** | Total positions, debits/credits, net cash flow, exposure, broker breakdown | ✅ Feb 2026 |
| **DTE Indicators** | Days-to-expiry with color coding (red <7 days, yellow <30) | ✅ Feb 2026 |

### AI-Powered Features
| Feature | Description | Completed |
|---------|-------------|-----------|
| **Screenshot Import** | Upload brokerage screenshots → AI extracts positions using OpenAI Vision API | ✅ Feb 2026 |
| **Smart Entry Price Calculation** | When entry price not shown, calculates from current price + % change | ✅ Feb 2026 |
| **Broker Auto-Detection** | Recognizes broker from screenshot UI | ✅ Feb 2026 |
| **Multi-Broker Support** | Handles various screenshot formats (Schwab, Robinhood, etc.) | ✅ Feb 2026 |

### UX Improvements
| Feature | Description | Completed |
|---------|-------------|-----------|
| **Mobile Responsive** | Fully responsive design, works on phone/desktop | ✅ Feb 2026 |
| **Edit Position** | Modify existing positions without re-entering | ✅ Feb 2026 |
| **Clear Form Button** | Reset form fields easily | ✅ Feb 2026 |
| **Autofill Prevention** | Aggressive anti-autofill measures for clean data entry | ✅ Feb 2026 |

---

## 🚧 In Progress / Planned

### High Priority
| # | Feature | Description | ETA |
|---|---------|-------------|-----|
| 1 | **Position Close Flow** | Record closing price, date, realized P&L → moves to "Closed Positions" view | TBD |
| 2 | **Greeks Dashboard** | Portfolio-level Delta, Theta, Gamma, Vega exposure | TBD |
| 3 | **P&L Heatmap** | 2D grid showing P&L at different price/time scenarios | TBD |
| 4 | **Price Alerts** | Browser notifications when option hits target price or P&L threshold | TBD |

### Medium Priority
| # | Feature | Description | ETA |
|---|---------|-------------|-----|
| 5 | **Position Sizer** | Calculate optimal contract count based on risk % and account size | TBD |
| 6 | **Rolling Suggestions** | Auto-flag positions approaching expiry or deep ITM/OTM for rolling | TBD |
| 7 | **Strategy Tagging** | Tag positions (Wheel, CSP, CC, Spread, etc.) and filter by strategy | TBD |
| 8 | **Partial Close** | Close part of a position (e.g., 2 of 5 contracts) | TBD |
| 9 | **Assignment Tracking** | Record put assignments, cost basis of resulting shares | TBD |
| 10 | **Performance Metrics** | Win rate, avg profit/loss, max drawdown, Sharpe ratio | TBD |

### Low Priority / Nice-to-Have
| # | Feature | Description | ETA |
|---|---------|-------------|-----|
| 11 | **Dark Mode** | Toggle between light/dark themes | TBD |
| 12 | **Earnings Calendar** | Show upcoming earnings for tickers in portfolio | TBD |
| 13 | **Volatility Analyzer** | Compare implied vs historical volatility | TBD |
| 14 | **PWA Support** | Install as mobile app, work offline | TBD |
| 15 | **Tax Report Export** | Export closed trades for tax software (1099-style) | TBD |
| 16 | **Correlation Matrix** | Show how positions correlate with each other | TBD |
| 17 | **Portfolio Heatmap** | Visual risk exposure by ticker/sector | TBD |
| 18 | **Multi-Account** | Track positions across multiple accounts separately | TBD |

---

## 🎯 Next Up (Recommended Order)

1. **Position Close Flow** - Essential for tracking realized P&L
2. **Greeks Dashboard** - Helpful for risk management
3. **Price Alerts** - Proactive notifications for decision-making

---

## 🛠 Technical Architecture

### Current Stack
- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Data:** localStorage (client-side only)
- **Market Data:** Yahoo Finance API (yahoo-finance2)
- **AI/OCR:** OpenAI GPT-4 Vision API (screenshot import)

### Deployment
- **Platform:** Vercel
- **Domain:** options.ai-capex.com
- **CI/CD:** Auto-deploy on git push to main

---

## 📊 Usage Stats (If Available)

*Track usage metrics here if analytics are added*

---

*Last updated: 2026-02-13*  
*Maintained by: Tom (AI Assistant)*
