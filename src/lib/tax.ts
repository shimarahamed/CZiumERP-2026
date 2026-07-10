import type { Store, TaxRate } from '@/types';

/**
 * Resolves the tax rate that applies to a transaction for a given store, in order
 * of specificity:
 *   1. A TaxRate whose jurisdiction matches the store's Store.taxJurisdiction.
 *   2. The tenant-wide isDefault rate (today's behavior).
 *   3. undefined (no rate configured) — callers should treat this as 0%, same as
 *      today's absent-taxRate behavior.
 * Purely additive: a tenant that never sets Store.taxJurisdiction or a rate's
 * jurisdiction always falls straight to step 2, identical to before this existed.
 */
export function resolveTaxRate(store: Store | undefined, taxRates: TaxRate[]): TaxRate | undefined {
  if (store?.taxJurisdiction) {
    const jurisdictionMatch = taxRates.find(r => r.jurisdiction === store.taxJurisdiction);
    if (jurisdictionMatch) return jurisdictionMatch;
  }
  return taxRates.find(r => r.isDefault);
}
