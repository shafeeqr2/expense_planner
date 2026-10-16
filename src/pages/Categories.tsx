import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Card, CategoryDot, Pill } from '../components/ui'
import { money0 } from '../lib/format'
import type { Rule } from '../types'

export default function Categories() {
  const { categories, transactions, user, seedRules, addRule, updateRule, deleteRule, toggleSeedRule, addCategory, updateCategory, exportRules, resetUserState } = useStore()
  const [tab, setTab] = useState<'categories' | 'rules'>('categories')
  const [q, setQ] = useState('')
  const [newCat, setNewCat] = useState('')
  const [draft, setDraft] = useState<{ match: string; category: string; label: string }>({ match: '', category: categories[0]?.name ?? '', label: '' })

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>()
    for (const t of transactions) { const e = m.get(t.category) ?? { n: 0, total: 0 }; e.n++; e.total += t.amount; m.set(t.category, e) }
    return m
  }, [transactions])
  const ruleUse = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) if (t.ruleId) m.set(t.ruleId, (m.get(t.ruleId) ?? 0) + 1)
    return m
  }, [transactions])
  const disabled = new Set(user.disabledRuleIds)
  const needle = q.trim().toUpperCase()
  const filt = (r: Rule) => !needle || r.match.toUpperCase().includes(needle) || r.category.toUpperCase().includes(needle) || (r.label ?? '').toUpperCase().includes(needle)
  const overridesCount = Object.keys(user.overrides).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {(['categories', 'rules'] as const).map((t) => <button key={t} className={`rounded-md px-3 py-1 text-sm capitalize ${tab === t ? 'bg-wash font-medium' : 'text-ink-2'}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-ink-2">
          <span>{user.rules.length} custom rules · {overridesCount} manual overrides</span>
          <button className="btn" onClick={exportRules} title="Download the merged rules file. Save it as data/rules.json to make your edits the new defaults.">Export rules.json</button>
          <button className="btn btn-danger" onClick={() => { if (confirm('Discard all custom rules, overrides and category edits?')) resetUserState() }}>Reset</button>
        </div>
      </div>

      {tab === 'categories' && (
        <Card title="Categories" subtitle="Recolor a category, mark it as income, or exclude it from totals entirely (transfers, investments). Money received in a normal category nets against its spending. Counts cover all time.">
          <div className="mb-3 flex gap-2">
            <input className="input" placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn" disabled={!newCat.trim()} onClick={() => { addCategory({ name: newCat.trim(), color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') }); setNewCat('') }}>Add</button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3"><tr className="border-b border-line"><th className="py-2 font-medium">Category</th><th className="py-2 pr-4 text-right font-medium">Txns</th><th className="py-2 pr-6 text-right font-medium">Net all time</th><th className="py-2 pr-4 text-center font-medium">Counts as income</th><th className="py-2 text-center font-medium">Exclude from totals</th></tr></thead>
            <tbody>
              {categories.map((c) => {
                const s = stats.get(c.name)
                return (
                  <tr key={c.name} className="border-b border-line last:border-0">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <input type="color" value={c.color} onChange={(e) => updateCategory(c.name, { color: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
                        <Link to={`/transactions?category=${encodeURIComponent(c.name)}`} className="hover:underline">{c.name}</Link>
                      </span>
                    </td>
                    <td className="tnum py-1.5 pr-4 text-right text-ink-2">{s?.n ?? 0}</td>
                    <td className={`tnum py-1.5 pr-6 text-right ${(s?.total ?? 0) >= 0 ? 'text-good' : ''}`}>{money0(s?.total ?? 0)}</td>
                    <td className="py-1.5 pr-4 text-center"><input type="checkbox" checked={!!c.treatAsIncome} onChange={(e) => updateCategory(c.name, { treatAsIncome: e.target.checked })} /></td>
                    <td className="py-1.5 text-center"><input type="checkbox" checked={!!c.excludeFromSpending} onChange={(e) => updateCategory(c.name, { excludeFromSpending: e.target.checked })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'rules' && (
        <>
          <Card title="Add a rule" subtitle="First matching rule wins. Your rules run before the built-in ones.">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-ink-2">Merchant contains<input className="input mt-1 block w-56" value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value })} /></label>
              <label className="text-xs text-ink-2">Category<select className="input mt-1 block" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{categories.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>
              <label className="text-xs text-ink-2">Display name (optional)<input className="input mt-1 block w-48" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
              <button className="btn btn-primary" disabled={!draft.match.trim()} onClick={() => { addRule({ match: draft.match.trim(), category: draft.category, label: draft.label.trim() || undefined }); setDraft({ ...draft, match: '', label: '' }) }}>Add rule</button>
            </div>
          </Card>

          <input className="input w-72" placeholder="Filter rules" value={q} onChange={(e) => setQ(e.target.value)} />

          {user.rules.length > 0 && (
            <Card title="Your rules">
              <RuleTable rules={user.rules.filter(filt)} use={ruleUse} categories={categories.map((c) => c.name)} editable onChange={updateRule} onDelete={deleteRule} />
            </Card>
          )}
          <Card title="Built-in rules" subtitle={`${seedRules.length} rules derived from your merchants. Untick to disable one; add a rule above to override it.`}>
            <RuleTable rules={seedRules.filter(filt)} use={ruleUse} categories={categories.map((c) => c.name)} disabled={disabled} onToggle={toggleSeedRule} />
          </Card>
        </>
      )}
    </div>
  )
}

function RuleTable({ rules, use, categories, editable, disabled, onChange, onDelete, onToggle }: {
  rules: Rule[]; use: Map<string, number>; categories: string[]; editable?: boolean; disabled?: Set<string>
  onChange?: (id: string, p: Partial<Rule>) => void; onDelete?: (id: string) => void; onToggle?: (id: string, enabled: boolean) => void
}) {
  return (
    <div className="max-h-[60vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-left text-xs text-ink-3"><tr className="border-b border-line">
          {onToggle && <th className="py-2"></th>}<th className="py-2 font-medium">Match</th><th className="py-2 font-medium">Category</th><th className="py-2 font-medium">Display name</th><th className="py-2 text-right font-medium">Used</th>{editable && <th></th>}
        </tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className={`border-b border-line last:border-0 ${disabled?.has(r.id) ? 'opacity-50' : ''}`}>
              {onToggle && <td className="py-1 pr-2"><input type="checkbox" checked={!disabled?.has(r.id)} onChange={(e) => onToggle(r.id, e.target.checked)} /></td>}
              <td className="py-1 pr-2 font-mono text-xs">
                {editable ? <input className="input w-full py-0.5" value={r.match} onChange={(e) => onChange?.(r.id, { match: e.target.value })} /> : <>{r.match}{r.regex && <Pill>regex</Pill>}</>}
              </td>
              <td className="py-1 pr-2">
                {editable ? <select className="input py-0.5 text-xs" value={r.category} onChange={(e) => onChange?.(r.id, { category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select> : <span className="flex items-center gap-2"><CategoryDot color="transparent" className="hidden" />{r.category}</span>}
              </td>
              <td className="py-1 pr-2 text-ink-2">{editable ? <input className="input w-full py-0.5" value={r.label ?? ''} onChange={(e) => onChange?.(r.id, { label: e.target.value || undefined })} /> : r.label}</td>
              <td className="tnum py-1 text-right text-ink-3">{use.get(r.id) ?? 0}</td>
              {editable && <td className="py-1 text-right"><button className="text-xs text-bad hover:underline" onClick={() => onDelete?.(r.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
