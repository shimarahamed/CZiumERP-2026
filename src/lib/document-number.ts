'use client';

import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';

/** Read the current counter value (the last number issued). 0 if never used. */
export async function getCounterValue(
  tenantId: string,
  type: 'invoice' | 'purchaseOrder' | 'refund'
): Promise<number> {
  const snap = await getDoc(doc(db, 'tenants', tenantId, 'counters', type));
  return snap.exists() ? ((snap.data().value as number) ?? 0) : 0;
}

/**
 * Set the counter so the NEXT issued number is `startAt`. Stores startAt-1 as
 * the current value, since getNextDocumentNumber increments before use.
 */
export async function setCounterStart(
  tenantId: string,
  type: 'invoice' | 'purchaseOrder' | 'refund',
  startAt: number
): Promise<void> {
  const value = Math.max(0, Math.floor(startAt) - 1);
  await setDoc(doc(db, 'tenants', tenantId, 'counters', type), { value }, { merge: true });
}

/**
 * Advance the counter so its value is at least `usedNumber` — used by the
 * optimistic invoice path, which computes a number locally (from the highest
 * existing invoice) for instant creation, then calls this in the background so
 * the authoritative counter never falls behind what was actually issued.
 * Fire-and-forget: failures are swallowed so creation never blocks.
 */
export async function bumpCounterToAtLeast(
  tenantId: string,
  type: 'invoice' | 'purchaseOrder' | 'refund',
  usedNumber: number
): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'tenants', tenantId, 'counters', type);
      const snap = await tx.get(ref);
      const current = (snap.exists() ? (snap.data().value as number) : 0) ?? 0;
      if (usedNumber > current) {
        tx.set(ref, { value: usedNumber }, { merge: true });
      }
    });
  } catch {
    /* best-effort; the next optimistic number recomputes from existing invoices */
  }
}

/**
 * Race-safe sequential document numbering.
 *
 * The previous approach (scan all invoices, max + 1) hands two concurrent
 * cashiers the SAME invoice number. This allocates from an atomic counter at
 * /tenants/{id}/counters/{type} inside a transaction, so numbers are unique
 * and gapless per tenant.
 *
 * Falls back to a caller-supplied number if the transaction fails (offline),
 * so document creation never blocks.
 */
export async function getNextDocumentNumber(
  tenantId: string,
  type: 'invoice' | 'purchaseOrder' | 'refund',
  prefix: string,
  fallback: () => number
): Promise<string> {
  try {
    const next = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'tenants', tenantId, 'counters', type);
      const snap = await tx.get(ref);
      const current = (snap.exists() ? (snap.data().value as number) : 0) ?? 0;
      const value = current + 1;
      tx.set(ref, { value }, { merge: true });
      return value;
    });
    return `${prefix}${String(next).padStart(3, '0')}`;
  } catch {
    return `${prefix}${String(fallback()).padStart(3, '0')}`;
  }
}
