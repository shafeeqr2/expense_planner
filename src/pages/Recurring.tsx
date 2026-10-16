import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Card, CategoryDot, Pill, StatTile, Empty } from '../components/ui'
import { money, money0, fmtDate } from '../lib/format'

export default function Recurring() {
  const { recurring, categoryMap } = useStore()
  const [showEnded, setShowEnded] = useState(false)
  const rows = useMemo(() => recurring.filter((r) => showEnded || r.active), [recurring, showEnded])
  const active = recurring.filter((r) => r.active)
  const monthly = active.reduce((a, r) => a + r.monthlyEquivalent, 0)
  const changed = active.filter((r) => r.priceChange)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of active) m.set(r.category, (m.get(r.category) ?? 0) + r.monthlyEquivalent)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [active])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Committed per month" value={monthly} hint="Active recurring charges, normalised to monthly" />
        <StatTile label="Per year" value={monthly * 12} />
        <StatTile label="Active series" value={active.length} format="number" hint={`${recurring.length - active.length} ended`} />
        <StatTile label="Recent price changes" value={changed.length} format="number" hint={changed.length ? changed.slice(0, 2).map((c) => c.label).join(', ') : 'None detected'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Commitment by category" subtitle="Monthly equivalent" className="lg:col-span-1">
          <table className="w-full text-sm"><tbody>
            {byCat.map(([c, v]) => (
              <tr key={c} className="border-t border-line first:border-0">
                <td className="py-1.5"><span className="flex items-center gap-2"><CategoryDot color={categoryMap.get(c)?.color ?? '#999'} />{c}</span></td>
                <td className="tnum py-1.5 text-right">{money0(v)}</td>
              </tr>
            ))}
          </tbody></table>
        </Card>

        <Card title="Recurring charges" subtitle="Detected from a steady rhythm of at least three charges. “Charge” is what you actually pay each time; “≈ per month” spreads yearly and biweekly charges evenly for budgeting." className="lg:col-span-2"
          action={<label className="flex items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /> Show ended</label>}>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-3"><tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Merchant</th><th className="py-2 pr-3 font-medium">Cadence</th><th className="py-2 pr-3 text-right font-medium">Charge</th><th className="py-2 pr-3 text-right font-medium">≈ per month</th><th className="py-2 pr-3 font-medium">Last</th><th className="py-2 pr-3 font-medium">Next</th><th className="py-2 font-medium"></th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-b border-line last:border-0 ${r.active ? '' : 'opacity-60'}`}>
                      <td className="py-1.5 pr-2">
                        <Link to={`/transactions?q=${encodeURIComponent(r.merchant)}`} className="flex items-center gap-2 text-ink hover:underline"><CategoryDot color={categoryMap.get(r.category)?.color ?? '#999'} />{r.label}</Link>
                        <div className="text-xs text-ink-3">{r.category} · {r.account} · {r.count}× since {fmtDate(r.firstDate)}</div>
                      </td>
                      <td className="py-1.5 pr-3"><Pill>{r.cadence}</Pill></td>
                      <td className="tnum py-1.5 pr-3 text-right">{money(r.avgAmount)}{r.amountVaries && <div className="text-[10px] text-ink-3">varies</div>}</td>
                      <td className="tnum py-1.5 pr-3 text-right font-medium">{money0(r.monthlyEquivalent)}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-ink-2">{fmtDate(r.lastDate)}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-ink-2">{r.active ? fmtDate(r.nextDate) : <Pill>ended</Pill>}</td>
                      <td className="py-1.5">{r.priceChange && <Pill tone={r.priceChange.to > r.priceChange.from ? 'bad' : 'good'}>{r.priceChange.to > r.priceChange.from ? '▲' : '▼'} {money(r.priceChange.from)} → {money(r.priceChange.to)}</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No recurring charges detected</Empty>}
        </Card>
      </div>
    </div>
  )
}
