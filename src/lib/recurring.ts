import type { Categorized } from './categorize'
import { addDays, daysBetween } from './format'

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

const CADENCES: { name: Cadence; days: number; tol: number; perMonth: number }[] = [
  { name: 'weekly', days: 7, tol: 2, perMonth: 52 / 12 },
  { name: 'biweekly', days: 14, tol: 3, perMonth: 26 / 12 },
  { name: 'monthly', days: 30.4, tol: 6, perMonth: 1 },
  { name: 'quarterly', days: 91, tol: 12, perMonth: 1 / 3 },
  { name: 'yearly', days: 365, tol: 25, perMonth: 1 / 12 },
]

export interface RecurringSeries {
  key: string
  merchant: string
  label: string
  category: string
  account: string
  cadence: Cadence
  count: number
  avgAmount: number
  lastAmount: number
  amountVaries: boolean
  priceChange?: { from: number; to: number }
  firstDate: string
  lastDate: string
  nextDate: string
  active: boolean
  monthlyEquivalent: number
  txnIds: string[]
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/**
 * Detect recurring outflows. Groups by merchant+account, needs >= 3 occurrences with a dominant
 * interval matching a known cadence. Same-day duplicates are merged so a split charge doesn't break the rhythm.
 */
export function detectRecurring(txns: Categorized[], excluded: Set<string>, asOf: string): RecurringSeries[] {
  const groups = new Map<string, Categorized[]>()
  for (const t of txns) {
    if (t.amount >= 0 || excluded.has(t.category) || t.category === 'Cash Withdrawal') continue
    const key = `${t.account}|${t.merchant}`
    const g = groups.get(key); if (g) g.push(t); else groups.set(key, [t])
  }
  const out: RecurringSeries[] = []
  for (const [key, g] of groups) {
    if (g.length < 3) continue
    g.sort((a, b) => a.date.localeCompare(b.date))
    // merge same-day
    const days: { date: string; amount: number; ids: string[] }[] = []
    for (const t of g) {
      const last = days[days.length - 1]
      if (last && last.date === t.date) { last.amount += -t.amount; last.ids.push(t.id) }
      else days.push({ date: t.date, amount: -t.amount, ids: [t.id] })
    }
    if (days.length < 3) continue
    const gaps = days.slice(1).map((d, i) => daysBetween(days[i].date, d.date))
    const med = median(gaps)
    const cad = CADENCES.find((c) => Math.abs(med - c.days) <= c.tol)
    if (!cad) continue
    const regular = gaps.filter((x) => Math.abs(x - cad.days) <= cad.tol * 1.5).length / gaps.length
    if (regular < 0.6) continue
    const amounts = days.map((d) => d.amount)
    const medAmt = median(amounts)
    const steady = amounts.filter((a) => Math.abs(a - medAmt) <= Math.max(2, medAmt * 0.25)).length / amounts.length
    // Variable-amount series (utilities) still count if the dates are very regular
    if (steady < 0.6 && regular < 0.85) continue
    // Three purchases a year apart is weak evidence unless the amount is the same each time (memberships, annual fees)
    if ((cad.name === 'yearly' || cad.name === 'quarterly') && steady < 0.9) continue
    const recent = days.slice(-6)
    const avgAmount = recent.reduce((a, d) => a + d.amount, 0) / recent.length
    const lastDate = days[days.length - 1].date
    const nextDate = addDays(lastDate, Math.round(cad.days))
    const active = daysBetween(lastDate, asOf) <= cad.days * 1.6 + cad.tol
    // price change: compare median of last 3 vs median of previous 3+
    let priceChange: RecurringSeries['priceChange']
    if (days.length >= 6 && steady >= 0.6) {
      const a = median(days.slice(-3).map((d) => d.amount)), b = median(days.slice(-6, -3).map((d) => d.amount))
      if (Math.abs(a - b) > Math.max(1, b * 0.05)) priceChange = { from: b, to: a }
    }
    const first = g[0]
    out.push({
      key, merchant: first.merchant, label: first.label, category: first.category, account: first.account,
      cadence: cad.name, count: days.length, avgAmount, lastAmount: days[days.length - 1].amount,
      amountVaries: steady < 0.6, priceChange, firstDate: days[0].date, lastDate, nextDate, active,
      monthlyEquivalent: avgAmount * cad.perMonth, txnIds: days.flatMap((d) => d.ids),
    })
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || b.monthlyEquivalent - a.monthlyEquivalent)
}
