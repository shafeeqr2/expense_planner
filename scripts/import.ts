/**
 * Import pipeline: RBC chequing CSV + RBC Visa statement PDFs -> public/data/transactions.json
 * Run: npm run import
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, basename } from 'node:path'
import type { Transaction, Dataset, StatementSummary } from '../src/types.ts'
import { normalizeMerchant, classifyKind } from './normalize.ts'

const ROOT = new URL('..', import.meta.url).pathname
const DATA = join(ROOT, 'data')
const OUT_DIR = join(ROOT, 'public', 'data')

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const money = (s: string) => Number(s.replace(/[$,]/g, ''))
const round2 = (n: number) => Math.round(n * 100) / 100

function makeId(parts: (string | number)[]) {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12)
}

// ---------- Chequing CSV ----------
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

function importChequing(file: string): Transaction[] {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const col = (name: string) => header.findIndex((h) => h === name)
  const iType = col('Account Type'), iDate = col('Transaction Date'), iD1 = col('Description 1'), iD2 = col('Description 2'), iCad = col('CAD$'), iUsd = col('USD$')
  const seen = new Map<string, number>()
  const txns: Transaction[] = []
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line)
    if (f[iType]?.trim() !== 'Chequing') continue
    const [m, d, y] = f[iDate].split('/').map(Number)
    const date = iso(y, m, d)
    const description = [f[iD1], f[iD2]].filter((s) => s && s.trim()).join(' ').replace(/\s+/g, ' ').trim()
    const amount = f[iCad] ? money(f[iCad]) : money(f[iUsd])
    // Same date+desc+amount can legitimately repeat; disambiguate with an occurrence counter
    const key = `${date}|${description}|${amount}`
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    txns.push({
      id: makeId(['chq', key, n]),
      account: 'chequing',
      date,
      description,
      merchant: normalizeMerchant(description, 'chequing'),
      amount,
      kind: classifyKind(description, 'chequing', amount),
    })
  }
  return txns
}

// ---------- Visa PDFs ----------
const TXN_RE = /^\s*([A-Z]{3}) (\d{2})\s+([A-Z]{3}) (\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})(?:\s|$)/
const PERIOD_RE = /STATEMENT FROM ([A-Z]{3}) (\d{1,2}),?\s*(\d{4})? TO ([A-Z]{3}) (\d{1,2}), (\d{4})/
const DATE_ONLY_RE = /^\s*([A-Z]{3}) (\d{2})\s+([A-Z]{3}) (\d{2})\s+(\S.*?)\s*$/
const AMOUNT_ONLY_RE = /^\s*(-?\$[\d,]+\.\d{2})(?:\s|$)/
const FX_RE = /Foreign Currency-([A-Z]{3})\s+([\d,]+\.\d{2})\s+Exchange rate-([\d.]+)/

function pdfToText(pdf: string): string {
  return execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
}

function importVisa(pdfDirs: string[]): { txns: Transaction[]; statements: StatementSummary[] } {
  const txns: Transaction[] = []
  const statements: StatementSummary[] = []
  const files = pdfDirs.flatMap((dir) => readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => join(dir, f))).sort()

  for (const pdf of files) {
    const text = pdfToText(pdf)
    const lines = text.split('\n')
    const period = text.match(PERIOD_RE)
    if (!period) throw new Error(`No statement period in ${pdf}`)
    const endY = Number(period[6]), endM = MONTHS[period[4]], endD = Number(period[5])
    const startM = MONTHS[period[1]], startD = Number(period[2])
    const startY = period[3] ? Number(period[3]) : startM > endM ? endY - 1 : endY
    const yearFor = (m: number) => (m > endM ? endY - 1 : endY)
    const periodEnd = iso(endY, endM, endD)

    const prevBal = text.match(/PREVIOUS (?:ACCOUNT|STATEMENT) BALANCE\s+(-?\$[\d,]+\.\d{2})/)
    const newBal = text.match(/(?:NEW|CREDIT) BALANCE\s+(-?\$[\d,]+\.\d{2})/)
    const previousBalance = prevBal ? money(prevBal[1]) : NaN
    const newBalance = newBal ? money(newBal[1]) : NaN

    const seen = new Map<string, number>()
    let count = 0
    let net = 0
    for (let i = 0; i < lines.length; i++) {
      let m: RegExpMatchArray | null = lines[i].match(TXN_RE)
      if (!m) {
        // Wrapped line: "JUN 20  JUN 23  D1 HAIR SALON" with the amount alone on a later line
        const head = lines[i].match(DATE_ONLY_RE)
        if (!head) continue
        for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
          if (DATE_ONLY_RE.test(lines[j])) break
          const amt = lines[j].match(AMOUNT_ONLY_RE)
          if (amt) { m = [...head, amt[1]] as unknown as RegExpMatchArray; break }
        }
        if (!m) continue
      }
      const [, tm, td, pm, pd, descRaw, amtRaw] = m
      const tMonth = MONTHS[tm], pMonth = MONTHS[pm]
      if (!tMonth || !pMonth) continue
      const date = iso(yearFor(tMonth), tMonth, Number(td))
      const postedDate = iso(yearFor(pMonth), pMonth, Number(pd))
      const description = descRaw.replace(/\s+/g, ' ').trim()
      // Statement shows charges positive, credits negative. Flip to money-out negative.
      const amount = -money(amtRaw)
      let foreign: Transaction['foreign']
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const fx = lines[j].match(FX_RE)
        if (fx) { foreign = { currency: fx[1], amount: money(fx[2]), rate: Number(fx[3]) }; break }
        if (TXN_RE.test(lines[j])) break
      }
      const key = `${date}|${description}|${amount}`
      const n = (seen.get(key) ?? 0) + 1
      seen.set(key, n)
      txns.push({
        id: makeId(['visa', periodEnd, key, n]),
        account: 'visa',
        date,
        postedDate,
        description,
        merchant: normalizeMerchant(description, 'visa'),
        amount,
        kind: classifyKind(description, 'visa', amount),
        foreign,
        statement: periodEnd,
      })
      count++
      net += amount
    }
    const parsedNet = round2(-net) // back to statement sign convention: charges increase balance
    const reconciled = Math.abs(round2(previousBalance + parsedNet) - newBalance) < 0.01
    statements.push({ file: basename(pdf), periodStart: iso(startY, startM, startD), periodEnd, previousBalance, newBalance, parsedNet, reconciled, count })
  }
  statements.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
  return { txns, statements }
}

// ---------- Transfer matching ----------
/** Pair visa payments with the chequing debit that funded them (same amount, within 5 days). */
function matchTransfers(all: Transaction[]) {
  const visaPayments = all.filter((t) => t.account === 'visa' && t.kind === 'transfer' && t.amount > 0)
  const chqCandidates = all.filter((t) => t.account === 'chequing' && t.amount < 0 && t.kind === 'transfer')
  const used = new Set<string>()
  let matched = 0
  for (const vp of visaPayments) {
    const vt = Date.parse(vp.date)
    let best: Transaction | undefined
    let bestGap = Infinity
    for (const c of chqCandidates) {
      if (used.has(c.id) || Math.abs(c.amount + vp.amount) > 0.001) continue
      const gap = Math.abs(Date.parse(c.date) - vt) / 86400000
      if (gap <= 5 && gap < bestGap) { best = c; bestGap = gap }
    }
    if (best) { used.add(best.id); vp.transferPairId = best.id; best.transferPairId = vp.id; matched++ }
  }
  return { visaPayments: visaPayments.length, matched }
}

// ---------- Main ----------
function main() {
  const csvs = readdirSync(DATA).filter((f) => f.toLowerCase().endsWith('.csv')).map((f) => join(DATA, f))
  const pdfDirs = readdirSync(DATA).filter((f) => existsSync(join(DATA, f)) && /^documents_\d+$/.test(f)).map((f) => join(DATA, f))
  console.log(`CSV files: ${csvs.length}, PDF folders: ${pdfDirs.length}`)

  const chequing = csvs.flatMap(importChequing)
  const { txns: visa, statements } = importVisa(pdfDirs)
  const all = [...chequing, ...visa].sort((a, b) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account))
  const tm = matchTransfers(all)

  const bad = statements.filter((s) => !s.reconciled)
  console.log(`Chequing: ${chequing.length} txns (${chequing[0]?.date} -> ${chequing.at(-1)?.date})`)
  console.log(`Visa: ${visa.length} txns across ${statements.length} statements; ${statements.length - bad.length} reconciled`)
  for (const s of bad) console.log(`  UNRECONCILED ${s.file}: prev ${s.previousBalance} + parsed ${s.parsedNet} = ${round2(s.previousBalance + s.parsedNet)} vs new ${s.newBalance} (${s.count} txns)`)
  console.log(`Visa payments: ${tm.visaPayments}, matched to chequing: ${tm.matched}`)
  const kinds = all.reduce<Record<string, number>>((a, t) => ((a[t.kind] = (a[t.kind] ?? 0) + 1), a), {})
  console.log('Kinds:', kinds)

  mkdirSync(OUT_DIR, { recursive: true })
  const dataset: Dataset = { generatedAt: new Date().toISOString(), transactions: all, statements }
  writeFileSync(join(OUT_DIR, 'transactions.json'), JSON.stringify(dataset))
  // Seed rules/categories live in data/rules.json (personal, gitignored); publish a copy for the app.
  const rulesSrc = join(DATA, 'rules.json')
  if (existsSync(rulesSrc)) {
    JSON.parse(readFileSync(rulesSrc, 'utf8')) // validate
    writeFileSync(join(OUT_DIR, 'rules.json'), readFileSync(rulesSrc))
    console.log('Published data/rules.json -> public/data/rules.json')
  }
  console.log(`Wrote ${all.length} transactions to public/data/transactions.json`)
}

main()
