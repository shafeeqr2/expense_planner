import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, usePeriodTransactions } from '../lib/store'
import { flows, monthlyFlows, monthsBetween, spendingByCategory, topMerchants, stackedMonthly } from '../lib/analytics'
import { Card, StatTile, CategoryDot, Pill, Empty } from '../components/ui'
import { IncomeSpendingChart, HBarChart, StackedCategoryChart, BalanceLine } from '../components/charts'
import { money, money0, fmtDate, addDays, daysBetween, pct } from '../lib/format'

export default function Dashboard() {
  const { transactions, sets, period, categoryMap, recurring, statements } = useStore()
  const txns = usePeriodTransactions()
  const [focus, setFocus] = useState<string | null>(null)

  const cur = useMemo(() => flows(txns, sets), [txns, sets])
  const prev = useMemo(() => {
    const len = daysBetween(period.start, period.end) + 1
    const pStart = addDays(period.start, -len), pEnd = addDays(period.start, -1)
    return flows(transactions.filter((t) => t.date >= pStart && t.date <= pEnd), sets)
  }, [transactions, period, sets])

  const months = useMemo(() => monthsBetween(period.start, period.end), [period])
  const monthly = useMemo(() => monthlyFlows(txns, sets, months), [txns, sets, months])
  const byCat = useMemo(() => spendingByCategory(txns, sets), [txns, sets])
  const merchants = useMemo(() => topMerchants(focus ? txns.filter((t) => t.category === focus) : txns, sets, 10), [txns, sets, focus])

  // Fixed slots: top 7 categories over the whole dataset, so colors never change with the filter
  const slots = useMemo(() => spendingByCategory(transactions, sets).slice(0, 7).map((c) => c.category), [transactions, sets])
  const stacked = useMemo(() => stackedMonthly(txns, sets, months, slots), [txns, sets, months, slots])

  const activeRecurring = recurring.filter((r) => r.active)
  const monthlyCommitted = activeRecurring.reduce((a, r) => a + r.monthlyEquivalent, 0)
  const visaSeries = useMemo(() => statements.filter((s) => s.periodEnd >= period.start && s.periodEnd <= period.end).map((s) => ({ date: s.periodEnd, balance: s.newBalance })), [statements, period])
  const latestVisa = statements[statements.length - 1]
  const totalIn = cur.income + cur.otherIn
  const savingsRate = totalIn > 0 ? cur.net / totalIn : 0
  const monthsInPeriod = Math.max(1, months.length)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Income" value={cur.income} delta={cur.income - prev.income} deltaLabel="vs previous" hint="Salary, government, other income" />
        <StatTile label="Other money in" value={cur.otherIn} delta={cur.otherIn - prev.otherIn} deltaLabel="vs previous" hint="Family, business, reimbursements" />
        <StatTile label="Spending" value={cur.spending} delta={cur.spending - prev.spending} deltaLabel="vs previous" upIsGood={false} hint="Refunds netted" />
        <StatTile label="Net" value={cur.net} delta={cur.net - prev.net} deltaLabel="vs previous" hint={totalIn > 0 ? `Savings rate ${pct(savingsRate)}` : undefined} />
        <StatTile label="Avg monthly spend" value={cur.spending / monthsInPeriod} hint={`${monthsInPeriod} month${monthsInPeriod > 1 ? 's' : ''}`} />
        <StatTile label="Recurring per month" value={monthlyCommitted} hint={`${activeRecurring.length} active subscriptions & bills`} />
      </div>

      <Card title="Money in vs spending" subtitle="Income is salary, government payments and other income. Other money in is anything received in a spending category, such as family transfers or business receipts. Transfers between your own accounts and investments are excluded.">
        {monthly.length ? <IncomeSpendingChart data={monthly} /> : <Empty>No data in this period</Empty>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Spending by category" subtitle={focus ? `Focused on ${focus}. Click again to clear.` : 'Click a bar to focus merchants'}>
          {byCat.length ? <HBarChart data={byCat.slice(0, 14).map((c) => ({ name: c.category, value: c.total }))} onClick={(n) => setFocus(focus === n ? null : n)} highlight={focus} /> : <Empty>No spending in this period</Empty>}
          <details className="mt-3 text-xs text-ink-2">
            <summary className="cursor-pointer">Table view</summary>
            <table className="mt-2 w-full"><tbody>
              {byCat.map((c) => (
                <tr key={c.category} className="border-t border-line">
                  <td className="py-1"><span className="flex items-center gap-2"><CategoryDot color={categoryMap.get(c.category)?.color ?? '#999'} />{c.category}</span></td>
                  <td className="tnum py-1 text-right">{c.count}</td>
                  <td className="tnum py-1 text-right">{money(c.total)}</td>
                  <td className="tnum py-1 text-right text-ink-3">{pct(c.total / cur.spending)}</td>
                </tr>
              ))}
            </tbody></table>
          </details>
        </Card>

        <Card title={focus ? `Top merchants in ${focus}` : 'Top merchants'} subtitle="By total spent in the period">
          {merchants.length ? (
            <table className="w-full text-sm">
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.merchant} className="border-t border-line first:border-0">
                    <td className="py-1.5 pr-2">
                      <Link to={`/transactions?q=${encodeURIComponent(m.merchant)}`} className="text-ink hover:underline">{m.label}</Link>
                      <div className="text-xs text-ink-3">{m.category} · {m.count}× · last {fmtDate(m.last)}</div>
                    </td>
                    <td className="tnum py-1.5 text-right font-medium">{money(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>Nothing here</Empty>}
        </Card>
      </div>

      <Card title="Monthly spending by category" subtitle="Top 7 categories keep fixed colors; everything else is folded into Other. Click a legend item to focus.">
        <StackedCategoryChart data={stacked} slots={slots} onSlotClick={(n) => setFocus(focus === n ? null : n)} active={focus} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Visa statement balance" subtitle={latestVisa ? `Latest statement ${fmtDate(latestVisa.periodEnd)}: ${money(latestVisa.newBalance)}` : undefined}>
          {visaSeries.length > 1 ? <BalanceLine data={visaSeries} dataKey="balance" name="Balance" /> : <Empty>Fewer than two statements in this period</Empty>}
        </Card>
        <Card title="Upcoming recurring charges" subtitle="Next expected dates based on past rhythm" action={<Link to="/recurring" className="text-xs text-accent hover:underline">See all</Link>}>
          <table className="w-full text-sm">
            <tbody>
              {activeRecurring.slice().sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 8).map((r) => (
                <tr key={r.key} className="border-t border-line first:border-0">
                  <td className="py-1.5"><span className="flex items-center gap-2"><CategoryDot color={categoryMap.get(r.category)?.color ?? '#999'} />{r.label}</span></td>
                  <td className="py-1.5 text-xs text-ink-3">{fmtDate(r.nextDate)}</td>
                  <td className="py-1.5 text-right"><Pill>{r.cadence}</Pill></td>
                  <td className="tnum py-1.5 text-right">{money0(r.avgAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
