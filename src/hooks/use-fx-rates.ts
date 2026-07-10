'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Currency, FXRate } from '@/types';

const CACHE_KEY = 'czium-fx-rates';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const FALLBACK_RATES: Partial<Record<Currency, number>> = {
  USD: 1, EUR: 0.92, JPY: 149.5, GBP: 0.79, AED: 3.67, LKR: 325,
};

export function useFXRates(base: Currency = 'USD') {
  const [fxRate, setFxRate] = useState<FXRate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    // Try cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: FXRate = JSON.parse(cached);
        if (parsed.base === base && Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
          setFxRate(parsed);
          return;
        }
      }
    } catch {}

    setIsLoading(true);
    setError(null);
    try {
      // Use a free open exchange rates API (no key needed for open.er-api.com)
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const result: FXRate = {
        base,
        rates: {
          USD: data.rates.USD,
          EUR: data.rates.EUR,
          JPY: data.rates.JPY,
          GBP: data.rates.GBP,
          AED: data.rates.AED,
          LKR: data.rates.LKR,
        },
        fetchedAt: new Date().toISOString(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      setFxRate(result);
    } catch {
      setError('Could not fetch live rates — using fallback');
      // Compute fallback relative to base
      const baseRate = FALLBACK_RATES[base] ?? 1;
      const rates: Partial<Record<Currency, number>> = {};
      (Object.keys(FALLBACK_RATES) as Currency[]).forEach(c => {
        rates[c] = (FALLBACK_RATES[c] ?? 1) / baseRate;
      });
      setFxRate({ base, rates, fetchedAt: new Date().toISOString() });
    } finally {
      setIsLoading(false);
    }
  }, [base]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const convert = useCallback((amount: number, from: Currency, to: Currency): number => {
    if (!fxRate || from === to) return amount;
    // Convert to base then to target
    const fromRate = from === fxRate.base ? 1 : (fxRate.rates[from] ?? 1);
    const toRate = to === fxRate.base ? 1 : (fxRate.rates[to] ?? 1);
    return amount * (toRate / fromRate);
  }, [fxRate]);

  return { fxRate, isLoading, error, convert, refetch: fetchRates };
}
