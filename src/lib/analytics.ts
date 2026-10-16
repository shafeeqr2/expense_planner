import type { Categorized } from './categorize'
import type { Category } from '../types'
import { monthKey } from './format'

export interface Period { start: string; end: string; label: string }

export function inPeriod(t: { date: string }, p: Period) {
  return t.date >= p.start && t.date <= p.end
}

export function excludedSet(categories: Category[]): Set<string> {
  return new Set(categories.filter((c) => c.excludeFromSpending).map((c) => c.name))
}
export function incomeSet(categories: Category[]): Set<string> {
  return new Set(categories.filter((c) => c.treatAsIncome).map((c) => c.name))
}
export interface Sets { excluded: Set<string>; income: Set<string> }

/**
 * Money in and out, ignoring excluded categories (transfers, investments).
 * income: amounts in income categories. spending: outflows in all other categories, with merchant refunds netted.
 * otherIn: money received in non-income categories (family transfers, business receipts, reimbursements).
 */
export function flows(txns: Categorized[], sets: Sets) {
  let income = 0, spending = 0, otherIn = 0
  for (const t of txns) {
    if (sets.excluded.has(t.category)) continue
    if (sets.income.has(t.category)) income += t.amount
    else if (t.amount < 0) spending += -t.amount
    else if (t.kind === 'refund') spending -= t.amount
    else otherIn += t.amount
  }
  return { income, spending, otherIn, net: income + otherIn - spending }
}

export interface MonthFlow { month: string; income: number; spending: number; otherIn: number; net: number }

export function monthlyFlows(txns: Categorized[], sets: Sets, months: string[]): MonthFlow[] {
  const map = new Map<string, { income: number; spending: number; otherIn: number }>()
  for (const m of months) map.set(m, { income: 0, spending: 0, otherIn: 0 })
  for (const t of txns) {
    if (sets.excluded.has(t.category)) continue
    const e = map.get(monthKey(t.date))
    if (!e) continue
    if (sets.income.has(t.category)) e.income += t.amount
    else if (t.amount < 0) e.spending += -t.amount
    else if (t.kind === 'refund') e.spending -= t.amount
    else e.otherIn += t.amount
  }
  return months.map((month) => { const e = map.get(month)!; return { month, ...e, net: e.income + e.otherIn - e.spending } })
}

export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = []
  let [y, m] = start.slice(0, 7).split('-').map(Number)
  const endKey = end.slice(0, 7)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= endKey) break
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

export interface CategoryTotal { category: string; total: number; count: number }

/** Spending per category (positive = money out, merchant refunds netted). Excluded and income categories omitted. */
export function spendingByCategory(txns: Categorized[], sets: Sets): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  for (const t of txns) {
    if (sets.excluded.has(t.category) || sets.income.has(t.category)) continue
    if (t.amount >= 0 && t.kind !== 'refund') continue
    const e = map.get(t.category) ?? { category: t.category, total: 0, count: 0 }
    e.total += -t.amount
    e.count++
    map.set(t.category, e)
  }
  return [...map.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total)
}

export interface MerchantTotal { merchant: string; label: string; category: string; total: number; count: number; last: string }

export function topMerchants(txns: Categorized[], sets: Sets, limit = 12): MerchantTotal[] {
  const map = new Map<string, MerchantTotal>()
  for (const t of txns) {
    if (sets.excluded.has(t.category) || sets.income.has(t.category) || t.amount >= 0) continue
    const e = map.get(t.merchant) ?? { merchant: t.merchant, label: t.label, category: t.category, total: 0, count: 0, last: t.date }
    e.total += -t.amount; e.count++; if (t.date > e.last) e.last = t.date
    map.set(t.merchant, e)
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit)
}

/** Stacked monthly spending: top N categories across the whole dataset get fixed slots; the rest fold into Other. */
export function stackedMonthly(txns: Categorized[], sets: Sets, months: string[], slotCategories: string[]) {
  const rows = months.map((month) => {
    const r: Record<string, number | string> = { month, Other: 0 }
    for (const c of slotCategories) r[c] = 0
    return r
  })
  const idx = new Map(months.map((m, i) => [m, i]))
  const slots = new Set(slotCategories)
  for (const t of txns) {
    if (sets.excluded.has(t.category) || sets.income.has(t.category)) continue
    if (t.amount >= 0 && t.kind !== 'refund') continue
    const i = idx.get(monthKey(t.date)); if (i === undefined) continue
    const key = slots.has(t.category) ? t.category : 'Other'
    rows[i][key] = (rows[i][key] as number) + -t.amount
  }
  return rows
}
