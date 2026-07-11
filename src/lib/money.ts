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

/**
 * Net line total: unit price × qty, less the line's own discount (if any).
 * `discountType 'percent'` (default) takes a % off the line; `'amount'` takes
 * a fixed amount off EACH UNIT (never below zero).
 */
export function lineTotal(
  unitPrice: number,
  quantity: number,
  discount = 0,
  discountType: 'percent' | 'amount' = 'percent',
): number {
  const gross = mulMoney(unitPrice, quantity);
  if (!(discount > 0)) return gross;
  if (discountType === 'amount') {
    return mulMoney(Math.max(0, addMoney(unitPrice, -discount)), quantity);
  }
  return addMoney(gross, -percentOf(gross, discount));
}

/** Net unit price after the product's own discount (percent or fixed amount). */
export function discountedUnitPrice(
  unitPrice: number,
  discount = 0,
  discountType: 'percent' | 'amount' = 'percent',
): number {
  return lineTotal(unitPrice, 1, discount, discountType);
}

/** Format a plain number with thousand separators, e.g. 12345.6 -> "12,345.60". */
export function formatNumber(amount: number, minimumFractionDigits = 2, maximumFractionDigits = 2): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits });
}

/** Format for display with a currency symbol and thousand separators. */
export function formatMoney(amount: number, symbol = '$'): string {
  return `${symbol}${formatNumber(amount)}`;
}
