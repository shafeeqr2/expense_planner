import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, type TooltipProps } from 'recharts'
import { fmtMonth, fmtMonthLong, money, moneyCompact } from '../lib/format'

export function useThemeVars() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    return { s: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--s${i}`)), other: v('--other'), grid: v('--grid'), axis: v('--axis'), ink2: v('--ink-2'), ink3: v('--ink-3'), accent: v('--accent'), accentSoft: v('--accent-soft'), surface: v('--surface-1'), bad: v('--bad') }
  }
  const [vars, setVars] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => setVars(read())
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return vars
}

export function ChartTooltip({ active, payload, label, title, order }: TooltipProps<number, string> & { title?: (l: string) => string; order?: 'asc' | 'desc' | 'none' }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value !== undefined && (p.value as number) !== 0)
  if (order === 'desc') rows.sort((a, b) => (b.value as number) - (a.value as number))
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-3">{title ? title(String(label)) : String(label)}</div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-ink-2"><span className="inline-block h-0.5 w-3" style={{ background: p.color }} />{p.name}</span>
          <span className="tnum font-semibold text-ink">{money(p.value as number)}</span>
        </div>
      ))}
    </div>
  )
}

const axisProps = (ink3: string) => ({ tick: { fill: ink3, fontSize: 11 }, axisLine: false as const, tickLine: false as const })

/** Income, other money in, and spending per month. Slots 3, 4, 1. */
export function IncomeSpendingChart({ data }: { data: { month: string; income: number; otherIn: number; spending: number }[] }) {
  const v = useThemeVars()
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={v.grid} />
          <XAxis dataKey="month" tickFormatter={fmtMonth} {...axisProps(v.ink3)} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={moneyCompact} {...axisProps(v.ink3)} width={48} />
          <Tooltip cursor={{ fill: v.grid, opacity: 0.4 }} content={<ChartTooltip title={fmtMonthLong} />} />
          <Bar dataKey="income" name="Income" fill={v.s[2]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="otherIn" name="Other money in" fill={v.s[3]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="spending" name="Spending" fill={v.s[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
      <Legend items={[{ name: 'Income', color: v.s[2] }, { name: 'Other money in', color: v.s[3] }, { name: 'Spending', color: v.s[0] }]} />
    </div>
  )
}

export function Legend({ items, onClick, active }: { items: { name: string; color: string }[]; onClick?: (name: string) => void; active?: string | null }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <button key={i.name} type="button" onClick={onClick ? () => onClick(i.name) : undefined} className={`flex items-center gap-1.5 ${onClick ? 'cursor-pointer hover:text-ink' : 'cursor-default'} ${active && active !== i.name ? 'opacity-40' : ''}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.name}
        </button>
      ))}
    </div>
  )
}

/** Horizontal single-hue bars: magnitude comparison across categories or merchants. */
export function HBarChart({ data, onClick, highlight }: { data: { name: string; value: number }[]; onClick?: (name: string) => void; highlight?: string | null }) {
  const v = useThemeVars()
  const h = Math.max(120, data.length * 28 + 16)
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={v.grid} />
          <XAxis type="number" tickFormatter={moneyCompact} {...axisProps(v.ink3)} />
          <YAxis type="category" dataKey="name" width={150} {...axisProps(v.ink3)} tick={{ fill: v.ink2, fontSize: 12 }} />
          <Tooltip cursor={{ fill: v.grid, opacity: 0.4 }} content={<ChartTooltip />} />
          <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={18} onClick={onClick ? (d) => onClick((d as unknown as { name: string }).name) : undefined} className={onClick ? 'cursor-pointer' : ''}
            label={{ position: 'right', fill: v.ink2, fontSize: 11, formatter: (x: number) => moneyCompact(x) }}>
            {data.map((d) => <Cell key={d.name} fill={highlight && highlight !== d.name ? v.other : v.s[0]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Stacked monthly spending by top categories (fixed slots) + Other. */
export function StackedCategoryChart({ data, slots, onSlotClick, active }: { data: Record<string, number | string>[]; slots: string[]; onSlotClick?: (name: string) => void; active?: string | null }) {
  const v = useThemeVars()
  const keys = [...slots, 'Other']
  const color = (k: string, i: number) => (k === 'Other' ? v.other : v.s[i])
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={v.grid} />
          <XAxis dataKey="month" tickFormatter={fmtMonth} {...axisProps(v.ink3)} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={moneyCompact} {...axisProps(v.ink3)} width={48} />
          <Tooltip cursor={{ fill: v.grid, opacity: 0.4 }} content={<ChartTooltip title={fmtMonthLong} order="desc" />} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} name={k} stackId="a" fill={color(k, i)} maxBarSize={28} stroke={v.surface} strokeWidth={1} opacity={active && active !== k ? 0.25 : 1} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <Legend items={keys.map((k, i) => ({ name: k, color: color(k, i) }))} onClick={onSlotClick} active={active} />
    </div>
  )
}

/** Single-series line, e.g. Visa statement balance over time. */
export function BalanceLine({ data, dataKey, name }: { data: Record<string, number | string>[]; dataKey: string; name: string }) {
  const v = useThemeVars()
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={v.grid} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtMonth(d.slice(0, 7))} {...axisProps(v.ink3)} interval="preserveStartEnd" minTickGap={32} />
          <YAxis tickFormatter={moneyCompact} {...axisProps(v.ink3)} width={48} />
          <Tooltip cursor={{ stroke: v.axis }} content={<ChartTooltip />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={v.s[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: v.surface, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
