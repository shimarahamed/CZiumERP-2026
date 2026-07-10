/**
 * Integer-cents money utilities. JS floats drift (0.1 + 0.2 !== 0.3), which
 * is unacceptable in invoices, GL, payroll, and tax. Store and compute in
 * cents; format only at the display edge.
 */

/** Convert a decimal amount (e.g. 19.99) to integer cents (1999). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert integer cents back to a decimal amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Add decimal amounts without float drift. */
export function addMoney(...amounts: number[]): number {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0));
}

/** Multiply a decimal unit price by a quantity, rounding once at the end. */
export function mulMoney(unitPrice: number, quantity: number): number {
  return fromCents(Math.round(toCents(unitPrice) * quantity));
}

/** Apply a percentage (e.g. tax or discount rate) with banker's-safe rounding. */
export function percentOf(amount: number, percent: number): number {
  return fromCents(Math.round((toCents(amount) * percent) / 100));
}

/** Format for display with a currency symbol. */
export function formatMoney(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toFixed(2)}`;
}
