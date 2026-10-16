export type Account = 'chequing' | 'visa'

/** Structural kind, derived at import time from the description. Independent of user categories. */
export type TxnKind =
  | 'purchase'   // spend at a merchant
  | 'refund'     // credit from a merchant
  | 'income'     // payroll, government, rebates
  | 'transfer'   // movement between own accounts (incl. visa payments)
  | 'etransfer'  // interac e-transfer / online transfer to or from a person
  | 'fee'        // bank fees
  | 'interest'   // interest charged or earned
  | 'cash'       // ATM withdrawal / cash advance
  | 'investment' // contributions to investment accounts
  | 'bill'       // bill payment via bank (utilities, insurance, etc.)

export interface Transaction {
  id: string
  account: Account
  date: string          // YYYY-MM-DD, transaction date
  postedDate?: string   // YYYY-MM-DD, visa only
  description: string   // raw text from the bank
  merchant: string      // normalized key used for rules and grouping
  amount: number        // CAD. Negative = money out, positive = money in
  kind: TxnKind
  foreign?: { currency: string; amount: number; rate: number }
  statement?: string    // visa statement period end, YYYY-MM-DD
  transferPairId?: string // id of matching txn on the other account
}

export interface Rule {
  id: string
  /** Case-insensitive match against merchant (or raw description if `onDescription`). Plain substring unless `regex` is true. */
  match: string
  regex?: boolean
  onDescription?: boolean
  category: string
  /** Optional nicer display name for the merchant */
  label?: string
  /** Lower runs first. Default 100. User rules default to 10. */
  priority?: number
  /** Optional signed-amount bounds (negative = money out). Both inclusive. */
  amountMin?: number
  amountMax?: number
  /** Optional date bounds, YYYY-MM-DD inclusive. */
  dateFrom?: string
  dateTo?: string
}

export interface Category {
  name: string
  color: string
  /** Treat as not-spending in dashboards (transfers, investments) */
  excludeFromSpending?: boolean
  /** Positive amounts count as income. Otherwise positive amounts net against the category's spending (refunds, reimbursements, money received). */
  treatAsIncome?: boolean
}

export interface Dataset {
  generatedAt: string
  transactions: Transaction[]
  statements: StatementSummary[]
}

export interface StatementSummary {
  file: string
  periodStart: string
  periodEnd: string
  previousBalance: number
  newBalance: number
  parsedNet: number
  reconciled: boolean
  count: number
}
