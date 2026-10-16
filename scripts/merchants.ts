/** Dump unique merchants for categorization review. Run: npm run merchants > data/merchants.tsv */
import { readFileSync } from 'node:fs'
import type { Dataset } from '../src/types.ts'
const ds: Dataset = JSON.parse(readFileSync(new URL('../public/data/transactions.json', import.meta.url), 'utf8'))
const map = new Map<string, { n: number; total: number; accounts: Set<string>; kinds: Set<string>; samples: Set<string> }>()
for (const t of ds.transactions) {
  const key = t.merchant
  const e = map.get(key) ?? { n: 0, total: 0, accounts: new Set(), kinds: new Set(), samples: new Set() }
  e.n++; e.total += t.amount; e.accounts.add(t.account); e.kinds.add(t.kind)
  if (e.samples.size < 2) e.samples.add(t.description)
  map.set(key, e)
}
const rows = [...map.entries()].sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
console.log(`# ${rows.length} unique merchants from ${ds.transactions.length} txns`)
for (const [m, e] of rows) console.log(`${m}\t${e.n}\t${e.total.toFixed(0)}\t${[...e.accounts].join('/')}\t${[...e.kinds].join('/')}\t${[...e.samples].join(' || ')}`)
