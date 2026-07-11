'use client';

import { useFXRates } from '@/hooks/use-fx-rates';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp } from '@/components/icons';
import type { Currency } from '@/types';
import { formatNumber } from '@/lib/money';

const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];

export function FXRatesWidget() {
  const { currency: baseCurrency, currencySymbols } = useAppContext();
  const { fxRate, isLoading, error, refetch } = useFXRates(baseCurrency);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Live FX Rates</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge variant="secondary" className="text-xs">Fallback</Badge>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!fxRate ? (
          <div className="space-y-2">
            {CURRENCIES.filter(c => c !== baseCurrency).map(c => (
              <div key={c} className="h-4 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              Base: {baseCurrency} · Updated {new Date(fxRate.fetchedAt).toLocaleTimeString()}
            </p>
            {CURRENCIES.filter(c => c !== baseCurrency).map(c => {
              const rate = fxRate.rates[c];
              const sym = currencySymbols[c] ?? c;
              return (
                <div key={c} className="flex items-center justify-between text-sm py-0.5 border-b last:border-0">
                  <span className="font-medium">{c}</span>
                  <span className="text-muted-foreground text-xs">{sym}</span>
                  <span className="font-mono tabular-nums">{rate != null ? formatNumber(rate, 4, 4) : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
