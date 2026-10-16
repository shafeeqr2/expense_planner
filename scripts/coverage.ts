/** Report rule coverage. Run: npx tsx scripts/coverage.ts */
import { readFileSync } from 'node:fs'
import type { Dataset } from '../src/types.ts'
import { categorizeAll, type RuleSet } from '../src/lib/categorize.ts'
const ds: Dataset = JSON.parse(readFileSync(new URL('../public/data/transactions.json', import.meta.url), 'utf8'))
const rs: RuleSet = JSON.parse(readFileSync(new URL('../data/rules.json', import.meta.url), 'utf8'))
const cats = categorizeAll(ds.transactions, rs.rules)
const known = new Set(rs.categories.map((c) => c.name))
const badCat = new Set(cats.filter((c) => !known.has(c.category)).map((c) => c.category))
if (badCat.size) console.log('RULES REFERENCE UNKNOWN CATEGORIES:', [...badCat])
const unc = cats.filter((c) => c.category === 'Uncategorized')
const uncAmt = unc.reduce((a, t) => a + Math.abs(t.amount), 0)
const totAmt = cats.reduce((a, t) => a + Math.abs(t.amount), 0)
console.log(`Uncategorized: ${unc.length}/${cats.length} txns (${((100 * unc.length) / cats.length).toFixed(1)}%), $${uncAmt.toFixed(0)} of $${totAmt.toFixed(0)} (${((100 * uncAmt) / totAmt).toFixed(1)}%)`)
const byM = new Map<string, { n: number; t: number }>()
for (const u of unc) { const e = byM.get(u.merchant) ?? { n: 0, t: 0 }; e.n++; e.t += u.amount; byM.set(u.merchant, e) }
console.log('--- uncategorized merchants ---')
for (const [m, e] of [...byM].sort((a, b) => Math.abs(b[1].t) - Math.abs(a[1].t))) console.log(`${m}\t${e.n}\t${e.t.toFixed(0)}`)
console.log('--- by category (count, net) ---')
const byC = new Map<string, { n: number; t: number }>()
for (const c of cats) { const e = byC.get(c.category) ?? { n: 0, t: 0 }; e.n++; e.t += c.amount; byC.set(c.category, e) }
for (const [m, e] of [...byC].sort((a, b) => a[1].t - b[1].t)) console.log(`${m}\t${e.n}\t${e.t.toFixed(0)}`)
