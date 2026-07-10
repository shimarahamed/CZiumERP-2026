'use client';

import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Invoice, IntercompanyTransaction, LedgerEntry, PayrollRun } from '@/types';
import { addMoney, mulMoney, percentOf } from '@/lib/money';

/**
 * Post an invoice through the server-side transactional function
 * (balanced GL entries + atomic stock decrement + server validation).
 *
 * Returns true when the server handled it. Returns false when the functions
 * backend is unavailable (not deployed / offline) so the caller can fall back
 * to the client-side write path — invoice creation never blocks on infra.
 */
export async function postInvoiceServerSide(invoice: Invoice): Promise<boolean> {
  try {
    const call = httpsCallable(getFunctions(app), 'postInvoiceWithLedger');
    await call({ invoice });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    // Validation failures should surface to the user, not silently fall back
    if (code.includes('failed-precondition') || code.includes('permission-denied')) {
      throw err;
    }
    return false; // backend unavailable → caller uses the client path
  }
}

/**
 * Build the balanced double-entry GL set for a paid invoice, mirroring the
 * server-side postInvoiceWithLedger function:
 *   Dr Accounts Receivable (total) / Cr Sales Revenue (net) + Cr Taxes Payable
 *   Dr Cost of Goods Sold / Cr Inventory (at cost)
 *
 * Entry IDs are deterministic per invoice so re-posting the same invoice
 * overwrites the same documents instead of duplicating them.
 */
export function buildInvoiceLedgerEntries(invoice: Invoice): LedgerEntry[] {
  const subtotal = addMoney(...invoice.items.map(i => mulMoney(i.price, i.quantity)), 0);
  const cogs = addMoney(...invoice.items.map(i => mulMoney(i.cost ?? 0, i.quantity)), 0);
  const discount = invoice.discount ? percentOf(subtotal, invoice.discount) : 0;
  const taxable = addMoney(subtotal, -discount);
  const tax = invoice.taxRate ? percentOf(taxable, invoice.taxRate) : 0;
  const total = addMoney(taxable, tax);

  const base = { date: invoice.date, storeId: invoice.storeId, description: `Invoice ${invoice.id}` };
  const entries: LedgerEntry[] = [
    { ...base, id: `gl-${invoice.id}-ar`, account: 'Accounts Receivable', debit: total, credit: 0 },
    { ...base, id: `gl-${invoice.id}-rev`, account: 'Sales Revenue', debit: 0, credit: taxable },
  ];
  if (tax > 0) {
    entries.push({ ...base, id: `gl-${invoice.id}-tax`, account: 'Taxes Payable', debit: 0, credit: tax, description: `Invoice ${invoice.id} tax` });
  }
  if (cogs > 0) {
    entries.push(
      { ...base, id: `gl-${invoice.id}-cogs`, account: 'Cost of Goods Sold', debit: cogs, credit: 0 },
      { ...base, id: `gl-${invoice.id}-inv`, account: 'Inventory', debit: 0, credit: cogs },
    );
  }
  return entries;
}

/**
 * Build the balanced double-entry GL set for a posted payroll run:
 *   Dr Salaries Expense (gross pay) / Cr Salaries Payable (net pay) + Cr Payroll
 *   Deductions Payable (withheld amount, if any)
 *
 * Entry IDs are deterministic per run so re-viewing the same run's history never
 * duplicates postings — posting itself is still guarded separately by checking
 * PayrollRun.ledgerEntryIds before calling this (see human-resources/payroll/page.tsx).
 */
export function buildPayrollLedgerEntries(run: PayrollRun): LedgerEntry[] {
  const base = { date: run.runDate, storeId: run.storeId, description: `Payroll ${run.periodLabel}` };
  const entries: LedgerEntry[] = [
    { ...base, id: `gl-${run.id}-salexp`, account: 'Salaries Expense', debit: run.totalGross, credit: 0 },
    { ...base, id: `gl-${run.id}-salpay`, account: 'Salaries Payable', debit: 0, credit: run.totalNet },
  ];
  if (run.totalDeductions > 0) {
    entries.push({
      ...base,
      id: `gl-${run.id}-ded`,
      account: 'Payroll Deductions Payable',
      debit: 0,
      credit: addMoney(run.totalDeductions, 0),
      description: `Payroll ${run.periodLabel} deductions`,
    });
  }
  return entries;
}

/**
 * Build the balanced double-entry GL set for an intercompany transaction — one
 * entry on each of the two stores' own books, using Due to/Due from accounts:
 *   fromStore: Dr Due from Affiliate (asset — they're owed the amount)
 *   toStore:   Cr Due to Affiliate (liability — they owe the amount)
 *
 * Both entries share intercompanyTransactionId so a consolidated report can find
 * and eliminate (net out) the pair rather than double-counting it across the
 * group. Each side stays a single, individually balanced-looking entry on its own
 * store's books (a real due-to/due-from pair, not literally the same journal
 * entry duplicated) — which is exactly why elimination at consolidation time,
 * not omission at posting time, is required for a correct group total.
 */
export function buildIntercompanyLedgerEntries(txn: IntercompanyTransaction): LedgerEntry[] {
  const amount = addMoney(txn.amount, 0);
  return [
    {
      id: `gl-${txn.id}-due-from`,
      date: txn.date,
      account: 'Due from Affiliate',
      description: txn.description,
      debit: amount,
      credit: 0,
      storeId: txn.fromStoreId,
      intercompanyTransactionId: txn.id,
    },
    {
      id: `gl-${txn.id}-due-to`,
      date: txn.date,
      account: 'Due to Affiliate',
      description: txn.description,
      debit: 0,
      credit: amount,
      storeId: txn.toStoreId,
      intercompanyTransactionId: txn.id,
    },
  ];
}
