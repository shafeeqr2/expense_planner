import type { ReactNode } from 'react'
import { money0, moneyCompact } from '../lib/format'

export function Card({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, delta, deltaLabel, upIsGood = true, hint, format = 'money' }: { label: string; value: number; delta?: number; deltaLabel?: string; upIsGood?: boolean; hint?: string; format?: 'money' | 'number' }) {
  const good = delta === undefined ? undefined : (delta >= 0) === upIsGood
  const shown = format === 'money' ? moneyCompact(value) : value.toLocaleString()
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink" title={format === 'money' ? money0(value) : undefined}>{shown}</div>
      {delta !== undefined && (
        <div className={`mt-1 text-xs ${good ? 'text-good' : 'text-bad'}`}>
          {delta >= 0 ? '▲' : '▼'} {moneyCompact(Math.abs(delta))} {deltaLabel}
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  )
}

export function CategoryDot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} style={{ background: color }} />
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'accent' }) {
  const cls = { neutral: 'bg-wash text-ink-2', good: 'text-good bg-wash', bad: 'text-bad bg-wash', warn: 'text-warn bg-wash', accent: 'text-accent bg-wash' }[tone]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-ink-3">{children}</div>
}
