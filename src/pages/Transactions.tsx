import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Card, CategoryDot, Pill } from '../components/ui'
import { money, fmtDate } from '../lib/format'
import type { Categorized } from '../lib/categorize'

const PAGE = 100

export default function Transactions() {
  const { transactions, categories, categoryMap, period, setOverride, addRule, effectiveRules } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [cat, setCat] = useState(params.get('category') ?? '')
  const [account, setAccount] = useState('')
  const [usePeriod, setUsePeriod] = useState(true)
  const [sort, setSort] = useState<'date' | 'amount'>('date')
  const [page, setPage] = useState(0)
  const [ruleFor, setRuleFor] = useState<Categorized | null>(null)

  useEffect(() => { setPage(0) }, [q, cat, account, usePeriod, period])
  useEffect(() => { const p = new URLSearchParams(); if (q) p.set('q', q); if (cat) p.set('category', cat); setParams(p, { replace: true }) }, [q, cat, setParams])

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase()
    let r = transactions.filter((t) =>
      (!usePeriod || (t.date >= period.start && t.date <= period.end)) &&
      (!cat || t.category === cat) &&
      (!account || t.account === account) &&
      (!needle || t.merchant.includes(needle) || t.description.toUpperCase().includes(needle) || t.label.toUpperCase().includes(needle)))
    r = sort === 'date' ? [...r].reverse() : [...r].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    return r
  }, [transactions, q, cat, account, usePeriod, period, sort])

  const total = rows.reduce((a, t) => a + t.amount, 0)
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE)
  const ruleById = useMemo(() => new Map(effectiveRules.map((r) => [r.id, r])), [effectiveRules])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-64" placeholder="Search merchant or description" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">Both accounts</option>
          <option value="chequing">Chequing</option>
          <option value="visa">Visa</option>
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'amount')}>
          <option value="date">Newest first</option>
          <option value="amount">Largest first</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-2"><input type="checkbox" checked={usePeriod} onChange={(e) => setUsePeriod(e.target.checked)} /> Limit to selected period</label>
        <div className="ml-auto text-sm text-ink-2"><span className="tnum">{rows.length.toLocaleString()}</span> transactions · net <span className={`tnum font-medium ${total < 0 ? 'text-ink' : 'text-good'}`}>{money(total)}</span></div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Merchant</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-wash">
                <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">{fmtDate(t.date)}</td>
                <td className="px-3 py-1.5">
                  <div className="text-ink">{t.label}</div>
                  <div className="max-w-md truncate text-xs text-ink-3" title={t.description}>{t.description}{t.foreign ? ` · ${t.foreign.currency} ${t.foreign.amount.toFixed(2)} @ ${t.foreign.rate}` : ''}</div>
                </td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <CategoryDot color={categoryMap.get(t.category)?.color ?? '#999'} />
                    <select className="input py-0.5 text-xs" value={t.category} onChange={(e) => setOverride(t.id, e.target.value)} title={t.overridden ? 'Manually set' : t.ruleId ? `Rule: ${ruleById.get(t.ruleId)?.match}` : 'No rule matched'}>
                      {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {t.overridden && <button className="text-xs text-ink-3 hover:text-ink" title="Clear manual override" onClick={() => setOverride(t.id, null)}>×</button>}
                  </span>
                </td>
                <td className="px-3 py-1.5"><Pill>{t.account}</Pill>{t.transferPairId && <span className="ml-1 text-xs text-ink-3" title="Matched to the other account">⇄</span>}</td>
                <td className={`tnum whitespace-nowrap px-3 py-1.5 text-right ${t.amount > 0 ? 'text-good' : 'text-ink'}`}>{money(t.amount)}</td>
                <td className="px-3 py-1.5 text-right"><button className="text-xs text-accent hover:underline" onClick={() => setRuleFor(t)}>Rule…</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-2">
            <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page + 1} of {Math.ceil(rows.length / PAGE)}</span>
            <button className="btn" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </Card>

      {ruleFor && <RuleDialog txn={ruleFor} onClose={() => setRuleFor(null)} onSave={(r) => { addRule(r); setRuleFor(null) }} />}
    </div>
  )
}

function RuleDialog({ txn, onClose, onSave }: { txn: Categorized; onClose: () => void; onSave: (r: { match: string; category: string; label?: string }) => void }) {
  const { categories, transactions } = useStore()
  const [match, setMatch] = useState(txn.merchant)
  const [category, setCategory] = useState(txn.category)
  const [label, setLabel] = useState(txn.label)
  const hits = useMemo(() => { const n = match.trim().toUpperCase(); return n ? transactions.filter((t) => t.merchant.includes(n)).length : 0 }, [match, transactions])
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">New rule</h3>
        <p className="mt-1 text-xs text-ink-3">Matches any transaction whose merchant contains the text below. Your rules run before the built-in ones.</p>
        <label className="mt-4 block text-xs text-ink-2">Merchant contains
          <input className="input mt-1 w-full" value={match} onChange={(e) => setMatch(e.target.value)} />
          <span className="text-ink-3">{hits} matching transaction{hits === 1 ? '' : 's'}</span>
        </label>
        <label className="mt-3 block text-xs text-ink-2">Category
          <select className="input mt-1 w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs text-ink-2">Display name
          <input className="input mt-1 w-full" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!match.trim()} onClick={() => onSave({ match: match.trim(), category, label: label.trim() || undefined })}>Save rule</button>
        </div>
      </div>
    </div>
  )
}
