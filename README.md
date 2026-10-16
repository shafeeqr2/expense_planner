# Expense Planner

Local-first expense analyzer for RBC chequing (CSV export) and RBC Visa (PDF statements). React + TypeScript + Vite + Tailwind. Nothing leaves your machine.

## Setup

```bash
npm install
# put your exports under data/ (gitignored):
#   data/*.csv                      RBC chequing "download transactions" CSV
#   data/documents_N/*.pdf          RBC Visa monthly statement PDFs (any folder named documents_<n>)
#   data/rules.json                 categories + categorization rules (seed provided)
npm run import     # parses CSV + PDFs (needs `pdftotext` from poppler-utils) -> public/data/
npm run dev        # http://localhost:5173
```

`npm run import` reconciles every Visa statement (previous balance + parsed transactions must equal the new balance) and pairs Visa payments with the chequing debit that funded them so transfers are never double counted.

## How categorization works

- `data/rules.json` holds the category list and ordered substring/regex rules matched against a normalized merchant key. First match wins.
- In the app you can override any single transaction, add your own rules (they run before the built-in ones), disable built-in rules, add categories, recolor, mark a category as income, or exclude it from totals.
- Those edits live in `localStorage`. **Export rules.json** on the Categories page downloads the merged result; save it as `data/rules.json` and rerun `npm run import` to make it the new default.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run import` | Rebuild `public/data/transactions.json` and copy rules |
| `npm run merchants > data/merchants.tsv` | Dump unique merchants with counts and totals |
| `npx tsx scripts/coverage.ts` | Show uncategorized merchants and per-category totals |
| `npm run build` | Production build to `dist/` |

## Layout

- `scripts/` import pipeline (`import.ts`, `normalize.ts`), merchant dump, coverage report
- `src/lib/` categorize engine, analytics, recurring detection, store (data + user edits)
- `src/pages/` Dashboard, Transactions, Recurring, Categories & Rules
- `src/components/` charts and small UI pieces
