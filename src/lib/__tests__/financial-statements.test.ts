import { describe, it, expect } from 'vitest';
import { classifyAccount, buildProfitAndLoss, buildBalanceSheet, buildCashFlow } from '@/lib/financial-statements';
import type { LedgerEntry } from '@/types';

const L = (account: string, debit: number, credit: number, date = '2026-06-15'): LedgerEntry =>
  ({ id: `${account}-${debit}-${credit}`, date, account, description: '', debit, credit });

// A balanced mini-ledger: cash sale 1000, expense 400 paid in cash, owner puts in 500
const ENTRIES: LedgerEntry[] = [
  L('Owner Equity', 0, 500, '2026-01-01'), L('Cash', 500, 0, '2026-01-01'),
  L('Sales Revenue', 0, 1000), L('Cash', 1000, 0),
  L('Rent Expense', 400, 0), L('Cash', 0, 400),
];

describe('financial statements', () => {
  it('classifies accounts by map and keywords', () => {
    expect(classifyAccount('Accounts Receivable')).toBe('asset');
    expect(classifyAccount('VAT Payable')).toBe('liability');
    expect(classifyAccount('Consulting Revenue')).toBe('income');
    expect(classifyAccount('Fuel Cost')).toBe('expense');
  });

  it('P&L computes net profit', () => {
    const pnl = buildProfitAndLoss(ENTRIES, '2026-01-01', '2026-12-31');
    expect(pnl.totalIncome).toBe(1000);
    expect(pnl.totalExpenses).toBe(400);
    expect(pnl.netProfit).toBe(600);
  });

  it('P&L respects the period window', () => {
    const pnl = buildProfitAndLoss(ENTRIES, '2026-07-01', '2026-12-31');
    expect(pnl.netProfit).toBe(0);
  });

  it('balance sheet balances (A = L + E incl. retained earnings)', () => {
    const bs = buildBalanceSheet(ENTRIES, '2026-12-31');
    expect(bs.totalAssets).toBe(1100); // 500 + 1000 - 400 cash
    expect(bs.totalEquity).toBe(1100); // 500 owner + 600 retained
    expect(bs.balanced).toBe(true);
  });

  it('cash flow tracks cash account movement', () => {
    const cf = buildCashFlow(ENTRIES, '2026-01-01', '2026-12-31');
    expect(cf.totalIn).toBe(1500);
    expect(cf.totalOut).toBe(400);
    expect(cf.netChange).toBe(1100);
  });
});
