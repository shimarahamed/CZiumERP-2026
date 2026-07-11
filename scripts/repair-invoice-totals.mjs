#!/usr/bin/env node
/**
 * One-time repair: recomputes invoice.amount and its matching General Ledger
 * entries (Accounts Receivable / Sales Revenue / Taxes Payable) for invoices
 * created before item-level discounts were wired into postInvoiceWithLedger.
 *
 * Root cause: the posting Cloud Function computed the subtotal from raw
 * price * quantity, ignoring each item's own discount/discountType, so
 * invoice.amount and the AR/Sales Revenue/Tax ledger entries were all booked
 * gross instead of net-of-item-discount. This script recalculates both using
 * the same formula the (now fixed) posting function uses:
 *   netSubtotal   = sum(lineTotal(item.price, item.qty, item.discount, item.discountType))
 *   discountAmt   = netSubtotal * (invoice.discount / 100)
 *   taxable       = netSubtotal - discountAmt
 *   tax           = taxable * (invoice.taxRate / 100)
 *   total         = taxable + tax
 *
 * Only touches invoices where at least one item has a discount (the only
 * case the old formula got wrong) and the recomputed total differs from the
 * stored amount by more than half a cent (float noise guard).
 *
 * Ledger entries have no invoiceId field — they're matched by their
 * deterministic `description: "Invoice {id}"` / `"Invoice {id} tax"` text,
 * the same convention postInvoiceWithLedger writes. cogs/Inventory entries
 * are untouched (cost has no discount concept and was already correct).
 *
 * Setup: same as scripts/manage-auth-users.mjs (serviceAccountKey.json).
 *
 * Usage:
 *   node scripts/repair-invoice-totals.mjs <tenantId> [--dry-run]
 *   node scripts/repair-invoice-totals.mjs --all [--dry-run]
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function toCents(amount) { return Math.round(amount * 100); }
function fromCents(cents) { return cents / 100; }
function addMoney(...amounts) { return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0)); }
function mulMoney(unitPrice, quantity) { return fromCents(Math.round(toCents(unitPrice) * quantity)); }
function percentOf(amount, percent) { return fromCents(Math.round((toCents(amount) * percent) / 100)); }
function lineTotal(unitPrice, quantity, discount = 0, discountType = 'percent') {
  const gross = mulMoney(unitPrice, quantity);
  if (!(discount > 0)) return gross;
  if (discountType === 'amount') {
    return mulMoney(Math.max(0, addMoney(unitPrice, -discount)), quantity);
  }
  return addMoney(gross, -percentOf(gross, discount));
}

function recompute(invoice) {
  const netSubtotal = addMoney(
    ...invoice.items.map(i => lineTotal(i.price, i.quantity, i.discount, i.discountType)),
    0
  );
  const discountAmt = invoice.discount ? percentOf(netSubtotal, invoice.discount) : 0;
  const taxable = addMoney(netSubtotal, -discountAmt);
  const tax = invoice.taxRate ? percentOf(taxable, invoice.taxRate) : 0;
  const total = addMoney(taxable, tax);
  return { taxable, tax, total };
}

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccountKey.json';
if (!existsSync(KEY_PATH)) {
  console.error(`Service account key not found at ${KEY_PATH}.`);
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const all = argv.includes('--all');
const tenantId = argv.find(a => !a.startsWith('--'));

async function repairTenant(id) {
  const invoicesSnap = await db.collection(`tenants/${id}/invoices`).get();
  const ledgerSnap = await db.collection(`tenants/${id}/ledgerEntries`).get();
  const ledgerDocs = ledgerSnap.docs;

  let fixedInvoices = 0;
  let fixedLedgerEntries = 0;
  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (batchOps === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const doc of invoicesSnap.docs) {
    const invoice = { id: doc.id, ...doc.data() };
    if (!Array.isArray(invoice.items) || invoice.items.length === 0) continue;
    const hasItemDiscount = invoice.items.some(i => (i.discount ?? 0) > 0);
    if (!hasItemDiscount) continue;

    const { taxable, tax, total } = recompute(invoice);
    const storedAmount = invoice.amount ?? 0;
    if (Math.abs(toCents(storedAmount) - toCents(total)) < 1) continue; // already correct

    console.log(`  [${id}] invoice ${invoice.id}: amount ${storedAmount} -> ${total}`);
    if (!dryRun) {
      batch.update(doc.ref, { amount: total });
      batchOps++;
    }
    fixedInvoices++;

    // Match this invoice's AR / Sales Revenue / Taxes Payable ledger entries
    // by their deterministic description text (no invoiceId field exists).
    const revDesc = `Invoice ${invoice.id}`;
    const taxDesc = `Invoice ${invoice.id} tax`;
    for (const ledgerDoc of ledgerDocs) {
      const entry = ledgerDoc.data();
      if (entry.description === revDesc && entry.account === 'Accounts Receivable' && entry.debit > 0) {
        if (Math.abs(toCents(entry.debit) - toCents(total)) >= 1) {
          console.log(`    ledger AR ${ledgerDoc.id}: debit ${entry.debit} -> ${total}`);
          if (!dryRun) { batch.update(ledgerDoc.ref, { debit: total }); batchOps++; }
          fixedLedgerEntries++;
        }
      } else if (entry.description === revDesc && entry.account === 'Sales Revenue' && entry.credit > 0) {
        if (Math.abs(toCents(entry.credit) - toCents(taxable)) >= 1) {
          console.log(`    ledger Sales Revenue ${ledgerDoc.id}: credit ${entry.credit} -> ${taxable}`);
          if (!dryRun) { batch.update(ledgerDoc.ref, { credit: taxable }); batchOps++; }
          fixedLedgerEntries++;
        }
      } else if (entry.description === taxDesc && entry.account === 'Taxes Payable' && entry.credit > 0) {
        if (Math.abs(toCents(entry.credit) - toCents(tax)) >= 1) {
          console.log(`    ledger Taxes Payable ${ledgerDoc.id}: credit ${entry.credit} -> ${tax}`);
          if (!dryRun) { batch.update(ledgerDoc.ref, { credit: tax }); batchOps++; }
          fixedLedgerEntries++;
        }
      }
    }

    if (batchOps >= 400) await flush(); // stay under Firestore's 500-op batch limit
  }
  await flush();

  console.log(`  ${id}: ${fixedInvoices} invoice(s), ${fixedLedgerEntries} ledger entr${fixedLedgerEntries === 1 ? 'y' : 'ies'} ${dryRun ? 'would be' : ''} fixed.`);
}

async function main() {
  if (!tenantId && !all) {
    console.error('Usage: node scripts/repair-invoice-totals.mjs <tenantId> [--dry-run]');
    console.error('       node scripts/repair-invoice-totals.mjs --all [--dry-run]');
    process.exit(1);
  }
  if (dryRun) console.log('[dry-run] no writes will be performed.\n');

  if (all) {
    const snap = await db.collection('tenants').get();
    console.log(`Scanning ${snap.size} tenant(s)...`);
    for (const doc of snap.docs) await repairTenant(doc.id);
  } else {
    const snap = await db.doc(`tenants/${tenantId}`).get();
    if (!snap.exists) {
      console.error(`Tenant "${tenantId}" not found.`);
      process.exit(1);
    }
    await repairTenant(tenantId);
  }
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
