# Options Tracker

A simple, local-first options portfolio tracker built with Next.js. Track your options positions, visualize P&L, and manage your portfolio in one place.

![Options Tracker Screenshot](screenshot.png)

## Features

- ✅ **Add Positions**: Track calls and puts with strike, expiry, quantity, and entry price
- ✅ **Portfolio Summary**: See total invested, current value, and P&L at a glance
- ✅ **Positions Table**: View all your options with days-to-expiry (DTE) highlighting
- ✅ **Local Storage**: All data stays in your browser - no server required
- ✅ **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts (ready for P&L visualization)
- **Storage**: LocalStorage (browser-based)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/TomB-coder/options-tracker.git
cd options-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding a Position

1. Fill out the form with your option details:
   - **Ticker**: Stock symbol (e.g., NVDA)
   - **Type**: Call or Put
   - **Strike Price**: Strike price of the option
   - **Expiry Date**: When the option expires
   - **Quantity**: Number of contracts
   - **Entry Price**: Price paid per contract
   - **Notes**: Optional strategy notes

2. Click "Add Position" to save

### Viewing Your Portfolio

- **Summary Cards**: See total positions, invested amount, and P&L
- **Positions Table**: View all positions with DTE (days to expiry) highlighting
  - Red: Less than 7 days
  - Yellow: Less than 30 days
  - Gray: More than 30 days

### Managing Positions

- Click **Delete** to remove a position
- Data is automatically saved to your browser's localStorage

## Roadmap

### v1.1 (Coming Soon)
- [ ] Live price integration (Yahoo Finance API)
- [ ] Real-time P&L calculation
- [ ] Portfolio charts and visualizations
- [ ] Export data to CSV

### v2.0 (Future)
- [ ] User authentication
- [ ] Cloud sync (Supabase/Firebase)
- [ ] Options Greeks calculator
- [ ] Strategy builder (spreads, iron condors, etc.)
- [ ] Alerts and notifications

## Development

### Project Structure

```
options-tracker/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/             # Utilities and storage
│   └── types/           # TypeScript types
├── public/              # Static assets
└── package.json
```

### Key Files

- `src/app/page.tsx` - Main dashboard page
- `src/components/AddPositionForm.tsx` - Form to add new positions
- `src/components/PositionsTable.tsx` - Table displaying all positions
- `src/components/PortfolioSummary.tsx` - Summary cards
- `src/lib/storage.ts` - LocalStorage operations
- `src/types/options.ts` - TypeScript interfaces

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### Deploying

#### Option 1: Vercel (Recommended)

1. Push to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Deploy automatically

#### Option 2: GitHub Pages

```bash
npm run build
# Copy dist folder to gh-pages branch
```

#### Option 3: Cloudflare Pages

Connect your GitHub repo to Cloudflare Pages for automatic deployments.

## Contributing

This is a personal project for learning purposes. Feel free to fork and modify for your own use!

## License

MIT License - see LICENSE file

## About

Built by [Jian Li](https://github.com/TomB-coder) as a learning project for:
- Learning Next.js and React
- Building practical tools for options trading
- Teaching web development concepts

---

**Note**: This tool is for educational purposes. Always do your own research and consult with a financial advisor before making investment decisions.
