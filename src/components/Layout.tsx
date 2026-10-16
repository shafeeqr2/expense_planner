import { NavLink, Outlet } from 'react-router-dom'
import { useStore, monthPeriod } from '../lib/store'
import { addMonths } from '../lib/format'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/categories', label: 'Categories & Rules' },
]

export default function Layout() {
  const { period, setPeriod, periodPresets, transactions, dataStart, dataEnd } = useStore()
  const isMonth = period.start.endsWith('-01') && period.end === monthPeriod(period.start.slice(0, 7)).end && !periodPresets.some((p) => p.label === period.label)
  const ym = period.start.slice(0, 7)
  const minYm = dataStart.slice(0, 7), maxYm = dataEnd.slice(0, 7)
  const goMonth = (delta: number) => { const next = addMonths(`${ym}-01`, delta).slice(0, 7); if (next >= minYm && next <= maxYm) setPeriod(monthPeriod(next)) }
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="text-base font-semibold text-ink">Expense Planner</div>
          <nav className="flex gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-wash font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-ink-2">
              <span className="hidden sm:inline">Period</span>
              <select className="input" value={isMonth ? '__month' : period.label} onChange={(e) => { if (e.target.value === '__month') { setPeriod(monthPeriod(maxYm)); return } const p = periodPresets.find((x) => x.label === e.target.value); if (p) setPeriod(p) }}>
                {periodPresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                <option value="__month">Single month…</option>
              </select>
            </label>
            {isMonth && (
              <span className="flex items-center gap-1">
                <button className="btn px-2" onClick={() => goMonth(-1)} disabled={ym <= minYm} aria-label="Previous month">◀</button>
                <input type="month" className="input" value={ym} min={minYm} max={maxYm} onChange={(e) => { if (e.target.value) setPeriod(monthPeriod(e.target.value)) }} />
                <button className="btn px-2" onClick={() => goMonth(1)} disabled={ym >= maxYm} aria-label="Next month">▶</button>
              </span>
            )}
            <span className="hidden text-xs text-ink-3 md:inline" title={`${transactions.length} transactions`}>Data to {dataEnd}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
