import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Dataset, Rule, Category, StatementSummary } from '../types'
import { categorizeAll, type Categorized, type RuleSet, UNCATEGORIZED } from './categorize'
import { detectRecurring, type RecurringSeries } from './recurring'
import { excludedSet, incomeSet, type Period, type Sets } from './analytics'
import { addDays, addMonths, todayIso } from './format'

export interface UserState {
  rules: Rule[]                       // user-created rules, run before seed rules
  disabledRuleIds: string[]           // seed rules switched off
  overrides: Record<string, string>   // txn id -> category
  addedCategories: Category[]
  categoryEdits: Record<string, Partial<Category>>
}

const EMPTY: UserState = { rules: [], disabledRuleIds: [], overrides: {}, addedCategories: [], categoryEdits: {} }
const LS_KEY = 'expense-planner:user-state:v1'

function loadUser(): UserState {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY } catch { return EMPTY }
}

export interface Store {
  loading: boolean
  error?: string
  transactions: Categorized[]
  statements: StatementSummary[]
  categories: Category[]
  categoryMap: Map<string, Category>
  excluded: Set<string>
  sets: Sets
  seedRules: Rule[]
  user: UserState
  effectiveRules: Rule[]
  recurring: RecurringSeries[]
  dataStart: string
  dataEnd: string
  period: Period
  setPeriod: (p: Period) => void
  periodPresets: Period[]
  // actions
  setOverride: (id: string, category: string | null) => void
  addRule: (r: Omit<Rule, 'id'>) => void
  updateRule: (id: string, patch: Partial<Rule>) => void
  deleteRule: (id: string) => void
  toggleSeedRule: (id: string, enabled: boolean) => void
  addCategory: (c: Category) => void
  updateCategory: (name: string, patch: Partial<Category>) => void
  exportRules: () => void
  resetUserState: () => void
}

const Ctx = createContext<Store | null>(null)

/** Period covering one calendar month, e.g. monthPeriod('2026-09'). */
export function monthPeriod(ym: string): Period {
  const start = `${ym}-01`
  const end = addDays(addMonths(start, 1), -1)
  const [y, m] = ym.split('-').map(Number)
  return { start, end, label: new Date(y, m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) }
}

export function buildPresets(dataStart: string, dataEnd: string): Period[] {
  const today = todayIso()
  const end = today > dataEnd ? today : dataEnd
  const ym = end.slice(0, 7)
  const presets: Period[] = [
    { label: 'Last 12 months', start: addMonths(`${ym}-01`, -11), end },
    { label: 'Last 3 months', start: addMonths(`${ym}-01`, -2), end },
    { label: 'This month', start: `${ym}-01`, end },
    { label: 'Last month', ...(({ start, end }) => ({ start, end }))(monthPeriod(addMonths(`${ym}-01`, -1).slice(0, 7))) },
    { label: 'Year to date', start: `${end.slice(0, 4)}-01-01`, end },
  ]
  for (let y = Number(end.slice(0, 4)); y >= Number(dataStart.slice(0, 4)); y--) presets.push({ label: String(y), start: `${y}-01-01`, end: `${y}-12-31` })
  presets.push({ label: 'All time', start: dataStart, end })
  return presets
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<Dataset | null>(null)
  const [seed, setSeed] = useState<RuleSet | null>(null)
  const [error, setError] = useState<string>()
  const [user, setUser] = useState<UserState>(loadUser)
  const [period, setPeriod] = useState<Period | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/data/transactions.json').then((r) => { if (!r.ok) throw new Error('transactions.json missing. Run `npm run import`.'); return r.json() }),
      fetch('/data/rules.json').then((r) => { if (!r.ok) throw new Error('rules.json missing. Run `npm run import`.'); return r.json() }),
    ]).then(([d, r]) => { setDs(d); setSeed(r) }).catch((e) => setError(String(e.message ?? e)))
  }, [])

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(user)) } catch { /* ignore */ } }, [user])

  const store = useMemo<Store | null>(() => {
    if (!ds || !seed) return null
    const seedRules = seed.rules.map((r, i) => ({ ...r, id: r.id ?? `seed-${i}`, priority: r.priority ?? 100 }))
    const disabled = new Set(user.disabledRuleIds)
    const effectiveRules = [...user.rules.map((r) => ({ ...r, priority: r.priority ?? 10 })), ...seedRules.filter((r) => !disabled.has(r.id))]
    const baseCats = [...seed.categories, ...user.addedCategories]
    const categories = baseCats.map((c) => ({ ...c, ...(user.categoryEdits[c.name] ?? {}) }))
    if (!categories.some((c) => c.name === UNCATEGORIZED)) categories.push({ name: UNCATEGORIZED, color: '#cbd5e1' })
    const categoryMap = new Map(categories.map((c) => [c.name, c]))
    const excluded = excludedSet(categories)
    const sets: Sets = { excluded, income: incomeSet(categories) }
    const transactions = categorizeAll(ds.transactions, effectiveRules, user.overrides)
    const dataStart = transactions[0]?.date ?? todayIso()
    const dataEnd = transactions[transactions.length - 1]?.date ?? todayIso()
    const recurring = detectRecurring(transactions, excluded, dataEnd)
    const periodPresets = buildPresets(dataStart, dataEnd)
    const p = period ?? periodPresets[0]
    const upd = (f: (u: UserState) => UserState) => setUser((u) => f(u))
    return {
      loading: false, error, transactions, statements: ds.statements, categories, categoryMap, excluded, sets, seedRules, user, effectiveRules,
      recurring, dataStart, dataEnd, period: p, setPeriod, periodPresets,
      setOverride: (id, category) => upd((u) => { const o = { ...u.overrides }; if (category) o[id] = category; else delete o[id]; return { ...u, overrides: o } }),
      addRule: (r) => upd((u) => ({ ...u, rules: [{ ...r, id: `user-${Date.now().toString(36)}`, priority: r.priority ?? 10 }, ...u.rules] })),
      updateRule: (id, patch) => upd((u) => ({ ...u, rules: u.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRule: (id) => upd((u) => ({ ...u, rules: u.rules.filter((r) => r.id !== id) })),
      toggleSeedRule: (id, enabled) => upd((u) => ({ ...u, disabledRuleIds: enabled ? u.disabledRuleIds.filter((x) => x !== id) : [...new Set([...u.disabledRuleIds, id])] })),
      addCategory: (c) => upd((u) => (categoryMap.has(c.name) ? u : { ...u, addedCategories: [...u.addedCategories, c] })),
      updateCategory: (name, patch) => upd((u) => ({ ...u, categoryEdits: { ...u.categoryEdits, [name]: { ...(u.categoryEdits[name] ?? {}), ...patch } } })),
      exportRules: () => {
        const out: RuleSet = { categories, rules: effectiveRules.map(({ id, priority, ...r }) => ({ ...r, ...(id.startsWith('user-') ? { id } : {}), ...(priority !== 100 ? { priority } : {}) })) as Rule[] }
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rules.json'; a.click(); URL.revokeObjectURL(a.href)
      },
      resetUserState: () => setUser(EMPTY),
    }
  }, [ds, seed, user, period, error])

  if (error) return <div className="p-8 text-bad">Failed to load data: {error}</div>
  if (!store) return <div className="p-8 text-ink-3">Loading transactions…</div>
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

/** Transactions within the selected period. */
export function usePeriodTransactions(): Categorized[] {
  const { transactions, period } = useStore()
  return useMemo(() => transactions.filter((t) => t.date >= period.start && t.date <= period.end), [transactions, period])
}
