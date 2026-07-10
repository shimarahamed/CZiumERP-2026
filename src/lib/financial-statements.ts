/**
 * Financial statements engine: P&L, Balance Sheet, and Cash Flow built from
 * the double-entry ledger. All arithmetic is integer-cents (money.ts).
 *
 * Account classification uses an explicit map first, then keyword heuristics,
 * so tenants with custom account names still get sensible statements.
 */
import { addMoney } from '@/lib/money';
import type { LedgerEntry } from '@/types';

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

const EXPLICIT: Record<string, AccountCategory> = {
  'accounts receivable': 'asset',
  'cash': 'asset',
  'bank': 'asset',
  'inventory': 'asset',
  'fixed assets': 'asset',
  'accounts payable': 'liability',
  'taxes payable': 'liability',
  'loans payable': 'liability',
  'owner equity': 'equity',
  'retained earnings': 'equity',
  'sales revenue': 'income',
  'service revenue': 'income',
  'other income': 'income',
  'cost of goods sold': 'expense',
  'salaries expense': 'expense',
  'rent expense': 'expense',
  'utilities expense': 'expense',
};

const KEYWORDS: [RegExp, AccountCategory][] = [
  [/receivable|cash|bank|inventory|asset|prepaid/i, 'asset'],
  [/payable|loan|liabilit|accrued|deferred/i, 'liability'],
  [/equity|capital|retained|drawing/i, 'equity'],
  [/revenue|income|sales(?!.*expense)/i, 'income'],
  [/expense|cost|cogs|salar|rent|utilit|depreciation|interest paid/i, 'expense'],
];

export function classifyAccount(account: string): AccountCategory {
  const key = account.trim().toLowerCase();
  if (EXPLICIT[key]) return EXPLICIT[key];
  for (const [re, cat] of KEYWORDS) {
    if (re.test(account)) return cat;
  }
  // Unknown accounts default to expense on P&L conservatism grounds
  return 'expense';
}

export type AccountLine = { account: string; amount: number };

function inRange(e: LedgerEntry, from?: string, to?: string): boolean {
  const d = e.date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Sum per account with the natural sign for its category. */
function totalsByAccount(entries: LedgerEntry[], categories: AccountCategory[], from?: string, to?: string): AccountLine[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (!inRange(e, from, to)) continue;
    const cat = classifyAccount(e.account);
    if (!categories.includes(cat)) continue;
    // Natural balances: income/liability/equity grow with credits; assets/expenses with debits
    const naturallyCredit = cat === 'income' || cat === 'liability' || cat === 'equity';
    const delta = naturallyCredit
      ? addMoney(e.credit || 0, -(e.debit || 0))
      : addMoney(e.debit || 0, -(e.credit || 0));
    map.set(e.account, addMoney(map.get(e.account) ?? 0, delta));
  }
  return [...map.entries()]
    .map(([account, amount]) => ({ account, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export type ProfitAndLoss = {
  income: AccountLine[];
  expenses: AccountLine[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

export function buildProfitAndLoss(entries: LedgerEntry[], from: string, to: string): ProfitAndLoss {
  const income = totalsByAccount(entries, ['income'], from, to);
  const expenses = totalsByAccount(entries, ['expense'], from, to);
  const totalIncome = addMoney(...income.map(l => l.amount), 0);
  const totalExpenses = addMoney(...expenses.map(l => l.amount), 0);
  return { income, expenses, totalIncome, totalExpenses, netProfit: addMoney(totalIncome, -totalExpenses) };
}

export type BalanceSheet = {
  assets: AccountLine[];
  liabilities: AccountLine[];
  equity: AccountLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number; // cumulative P&L folded into equity so the sheet balances
  balanced: boolean;
};

export function buildBalanceSheet(entries: LedgerEntry[], asOf: string): BalanceSheet {
  const assets = totalsByAccount(entries, ['asset'], undefined, asOf);
  const liabilities = totalsByAccount(entries, ['liability'], undefined, asOf);
  const equity = totalsByAccount(entries, ['equity'], undefined, asOf);
  const pnl = buildProfitAndLoss(entries, '0000-01-01', asOf);
  const totalAssets = addMoney(...assets.map(l => l.amount), 0);
  const totalLiabilities = addMoney(...liabilities.map(l => l.amount), 0);
  const equityBase = addMoney(...equity.map(l => l.amount), 0);
  const totalEquity = addMoney(equityBase, pnl.netProfit);
  return {
    assets, liabilities, equity,
    totalAssets, totalLiabilities, totalEquity,
    retainedEarnings: pnl.netProfit,
    balanced: Math.abs(addMoney(totalAssets, -addMoney(totalLiabilities, totalEquity))) < 0.01,
  };
}

export type CashFlow = {
  inflows: AccountLine[];
  outflows: AccountLine[];
  totalIn: number;
  totalOut: number;
  netChange: number;
};

const CASH_RE = /cash|bank/i;

/**
 * Simplified direct-method cash flow: movements on cash/bank accounts within
 * the period, split by direction. (Indirect method needs full journal linking
 * — a documented later enhancement.)
 */
export function buildCashFlow(entries: LedgerEntry[], from: string, to: string): CashFlow {
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();
  for (const e of entries) {
    if (!inRange(e, from, to) || !CASH_RE.test(e.account)) continue;
    if ((e.debit || 0) > 0) inMap.set(e.account, addMoney(inMap.get(e.account) ?? 0, e.debit));
    if ((e.credit || 0) > 0) outMap.set(e.account, addMoney(outMap.get(e.account) ?? 0, e.credit));
  }
  const inflows = [...inMap.entries()].map(([account, amount]) => ({ account, amount }));
  const outflows = [...outMap.entries()].map(([account, amount]) => ({ account, amount }));
  const totalIn = addMoney(...inflows.map(l => l.amount), 0);
  const totalOut = addMoney(...outflows.map(l => l.amount), 0);
  return { inflows, outflows, totalIn, totalOut, netChange: addMoney(totalIn, -totalOut) };
}
