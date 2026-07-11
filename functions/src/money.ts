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

/**
 * Net line total: unit price x qty, less the line's own discount (if any).
 * discountType "percent" (default) takes a % off the line; "amount" takes a
 * fixed amount off EACH UNIT (never below zero). Mirrors src/lib/money.ts.
 * @param {number} unitPrice Decimal unit price.
 * @param {number} quantity Line quantity.
 * @param {number} [discount] Discount value (percent or fixed amount).
 * @param {"percent" | "amount"} [discountType] Discount kind.
 * @return {number} The net line total as a decimal dollar amount.
 */
export function lineTotal(
  unitPrice: number,
  quantity: number,
  discount = 0,
  discountType: "percent" | "amount" = "percent",
): number {
  const gross = mulMoney(unitPrice, quantity);
  if (!(discount > 0)) return gross;
  if (discountType === "amount") {
    return mulMoney(Math.max(0, addMoney(unitPrice, -discount)), quantity);
  }
  return addMoney(gross, -percentOf(gross, discount));
}
