import type { Rule, Transaction, Category } from '../types'

export interface RuleSet {
  categories: Category[]
  rules: Rule[]
}

export const UNCATEGORIZED = 'Uncategorized'

/** Assign stable ids and default priorities; keep file order as tie-breaker. */
export function prepareRules(rules: Rule[]): Rule[] {
  return rules
    .map((r, i) => ({ ...r, id: r.id ?? `seed-${i}`, priority: r.priority ?? 100, _i: i }))
    .sort((a, b) => a.priority! - b.priority! || a._i - b._i)
    .map(({ _i, ...r }) => r)
}

type Compiled = { rule: Rule; test: (t: Pick<Transaction, 'merchant' | 'description' | 'amount' | 'date'>) => boolean }

export function compileRules(rules: Rule[]): Compiled[] {
  return prepareRules(rules).map((rule) => {
    const needle = rule.match.toUpperCase()
    const re = rule.regex ? new RegExp(rule.match, 'i') : null
    return {
      rule,
      test: (t) => {
        if (rule.amountMin !== undefined && t.amount < rule.amountMin) return false
        if (rule.amountMax !== undefined && t.amount > rule.amountMax) return false
        if (rule.dateFrom && t.date < rule.dateFrom) return false
        if (rule.dateTo && t.date > rule.dateTo) return false
        const hay = rule.onDescription ? t.description : t.merchant
        return re ? re.test(hay) : hay.toUpperCase().includes(needle)
      },
    }
  })
}

export function matchRule(compiled: Compiled[], t: Pick<Transaction, 'merchant' | 'description' | 'amount' | 'date'>): Rule | undefined {
  for (const c of compiled) if (c.test(t)) return c.rule
  return undefined
}

export interface Categorized extends Transaction {
  category: string
  label: string
  ruleId?: string
  /** true when the category came from a per-transaction override rather than a rule */
  overridden?: boolean
}

export function categorizeAll(
  txns: Transaction[],
  rules: Rule[],
  overrides: Record<string, string> = {},
): Categorized[] {
  const compiled = compileRules(rules)
  return txns.map((t) => {
    const o = overrides[t.id]
    const r = matchRule(compiled, t)
    return {
      ...t,
      category: o ?? r?.category ?? UNCATEGORIZED,
      label: r?.label ?? titleCase(t.merchant),
      ruleId: r?.id,
      overridden: o !== undefined,
    }
  })
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Etransfer|E-transfer)\b/g, 'e-Transfer')
    .replace(/\bRbc\b/g, 'RBC')
    .replace(/\bTd\b/g, 'TD')
    .replace(/\bCra\b/g, 'CRA')
    .replace(/\bAtm\b/g, 'ATM')
    .replace(/\bTfsa\b/g, 'TFSA')
    .replace(/\bEi\b/g, 'EI')
    .replace(/\bGst\b/g, 'GST')
    .replace(/\bNsf\b/g, 'NSF')
    .replace(/\bLcbo\b/g, 'LCBO')
    .replace(/\bIkea\b/g, 'IKEA')
}
