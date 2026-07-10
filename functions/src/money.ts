/**
 * Converts a decimal dollar amount to an integer number of cents.
 * @param {number} amount Decimal dollar amount.
 * @return {number} Integer number of cents.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converts an integer number of cents back to a decimal dollar amount.
 * @param {number} cents Integer number of cents.
 * @return {number} Decimal dollar amount.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Sums decimal dollar amounts, rounding through integer cents.
 * @param {...number} amounts Decimal dollar amounts to sum.
 * @return {number} The rounded sum as a decimal dollar amount.
 */
export function addMoney(...amounts: number[]): number {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0));
}

/**
 * Multiplies a unit price by a quantity, rounding through integer cents.
 * @param {number} unitPrice Decimal dollar unit price.
 * @param {number} quantity Quantity to multiply by.
 * @return {number} The rounded product as a decimal dollar amount.
 */
export function mulMoney(unitPrice: number, quantity: number): number {
  return fromCents(Math.round(toCents(unitPrice) * quantity));
}

/**
 * Computes a percentage of a decimal dollar amount.
 * @param {number} amount Decimal dollar amount.
 * @param {number} percent Percentage to compute, e.g. 5 for 5%.
 * @return {number} The rounded percentage as a decimal dollar amount.
 */
export function percentOf(amount: number, percent: number): number {
  return fromCents(Math.round((toCents(amount) * percent) / 100));
}
