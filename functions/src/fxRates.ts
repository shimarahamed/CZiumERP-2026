import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

type Currency = "USD" | "EUR" | "JPY" | "GBP" | "AED" | "LKR";

const CURRENCIES: Currency[] = ["USD", "EUR", "JPY", "GBP", "AED", "LKR"];

const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1, EUR: 0.92, JPY: 149.5, GBP: 0.79, AED: 3.67, LKR: 325,
};

// A single tenant-independent rate table, base USD, refreshed hourly. Every
// tenant's currency conversion (any Currency -> any Currency) is derived by
// cross-multiplying through this one base, exactly like the client-only
// src/hooks/use-fx-rates.ts already does — so one shared doc is sufficient
// and avoids per-tenant external API calls.
const RATES_DOC_PATH = "systemConfig/fxRates";

/**
 * Fetches live FX rates (base USD) and caches them in Firestore. Falls back
 * to a static rate table if the external API is unreachable.
 * @return {Promise<void>} Resolves once the cache doc has been written.
 */
async function fetchAndStoreRates(): Promise<void> {
  const db = getFirestore();
  let rates: Record<Currency, number>;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json() as {rates: Record<string, number>};
    rates = CURRENCIES.reduce((acc, c) => {
      acc[c] = data.rates[c] ?? FALLBACK_RATES[c];
      return acc;
    }, {} as Record<Currency, number>);
  } catch {
    rates = FALLBACK_RATES;
  }
  await db.doc(RATES_DOC_PATH).set({
    base: "USD",
    rates,
    fetchedAt: new Date().toISOString(),
  });
}

export const refreshFxRates = onSchedule("every 60 minutes", async () => {
  await fetchAndStoreRates();
});

// Callable so the first deploy (or an empty cache) can be populated on
// demand rather than waiting up to an hour for the schedule to fire.
export const refreshFxRatesNow = onCall(async () => {
  await fetchAndStoreRates();
  return {success: true};
});

/**
 * Reads the cached rate table and converts an amount between currencies.
 * Used server-side (inside Firestore transactions) so postInvoiceWithLedger
 * doesn't trust a client-supplied conversion for the ledger's debit/credit.
 * @param {number} amount Amount in the `from` currency.
 * @param {Currency} from Source currency.
 * @param {Currency} to Target currency.
 * @return {Promise<{converted: number, rate: number}>} Converted amount and
 * the rate used.
 */
export async function convertServerSide(
  amount: number,
  from: Currency,
  to: Currency
): Promise<{converted: number; rate: number}> {
  if (from === to) return {converted: amount, rate: 1};
  const db = getFirestore();
  const snap = await db.doc(RATES_DOC_PATH).get();
  const rates: Record<Currency, number> = snap.exists ?
    (snap.data()?.rates as Record<Currency, number>) :
    FALLBACK_RATES;
  const fromRate = rates[from] ?? FALLBACK_RATES[from];
  const toRate = rates[to] ?? FALLBACK_RATES[to];
  const rate = toRate / fromRate;
  return {converted: amount * rate, rate};
}
