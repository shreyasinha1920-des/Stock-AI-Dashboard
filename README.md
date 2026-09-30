# Aurum

An AI-first stock portfolio dashboard. The assistant is a Siri Orb that lives behind the
hero and comes forward into a conversation stage when summoned (`/`, `Space`, clicking
its glow, or the "Ask your portfolio" field). Answers stream in with inline dither charts,
and the dashboard cards they refer to light up behind the stage.

**Use your own portfolio:** click **Edit portfolio** (or the "Sample portfolio" badge), then
add holdings row by row or paste CSV (`ticker, shares, avg cost`). Everything updates to
match, and it's saved in your browser only. Prices come from a mock price book of 30 common
tickers; anything else can be added with a price you type, and is shown flat.

**Import from your broker:** in Edit portfolio → **Import file**, drop an Excel, CSV or text PDF
holdings file. It's read in the browser and never uploaded; only holdings are kept (names,
account numbers and PAN are ignored). Tested with Zerodha's holdings export (Console →
Portfolio → Holdings → download); other exports and CDSL/NSDL holding statements work when they
have a clear holdings table. Depository statements have no purchase price, so returns need the
cost typed in. Indian holdings switch Aurum to ₹ and the Nifty 50. Prices come from the file;
earlier daily/weekly moves are simulated from a mock price book.

**Voice:** press the mic in the hero's Ask field. The orb listens right there on the home
screen, the chat opens as soon as your words are recognised, and the question is asked
when you stop speaking. (Needs a browser with speech recognition, e.g. Chrome or Safari.)

Mock prices. Not financial advice.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where things live

- `data/portfolio.ts`: the mock price book and `buildPortfolio(input)`, which derives every
  number (totals, weights, movers, risk, chart history, events) from your positions.
- `data/ai-responses.ts`: answer templates that adapt to any portfolio (up weeks, single
  stocks, no tech, and so on), plus the hero headline and "Aurum noticed" copy.
- `components/portfolio/`: `PortfolioProvider` (saved input, `localStorage`) and
  `PortfolioEditor` (the side sheet).
- `lib/import/`: file importers. `table.ts` maps columns by header name; `xlsx.ts` (fflate),
  `csv.ts` and `pdf.ts` (pdf.js, loaded only for PDFs) turn files into tables. The pdf.js
  worker is copied to `public/` on `npm install`.
- `lib/intent.ts`: keyword + fuzzy intent matcher.
- `components/ai/`: `AIProvider` (state machine), `AISurface` (GSAP summon/dismiss
  timeline, drift, shortcuts), `AmbientOrb`, `ConversationStage`, `AIResponse`.
- `components/dashboard/`: `PortfolioHero`, `PerformanceChart`, `HoldingsTable`,
  `AllocationChart`, `RiskSnapshot`, `TopMovers`, `UpcomingEvents`.
- `components/ui/smoothui/`: Siri Orb, AI core and Dither Chart, installed with
  `npx smoothui-cli add siri-orb dither-chart`. The dither chart has three small,
  commented additions (value `domain`, bars around zero, per-point colour).

## Design notes

Visual rules come from the framer design skill (dark, Geist + EB Garamond, 4px grid,
`#1f1f1f` hairlines). The skill bans blur, so the page recedes with a brightness dim and
a dither dot veil instead; the only blur is inside the orb component itself.
