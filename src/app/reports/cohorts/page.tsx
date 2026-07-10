'use client';

import { useMemo } from 'react';
import { format, parseISO, startOfMonth, differenceInMonths } from 'date-fns';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppContext } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export default function CohortAnalysisPage() {
  const { invoices, customers } = useAppContext();

  const cohortData = useMemo(() => {
    // Determine each customer's first purchase month (cohort)
    const firstPurchase = new Map<string, Date>();
    invoices
      .filter(i => i.status === 'paid' && i.customerId)
      .forEach(inv => {
        const d = parseISO(inv.date);
        const existing = firstPurchase.get(inv.customerId!);
        if (!existing || d < existing) firstPurchase.set(inv.customerId!, d);
      });

    // Group customers by cohort month
    const cohorts = new Map<string, Set<string>>();
    firstPurchase.forEach((d, cId) => {
      const key = format(startOfMonth(d), 'yyyy-MM');
      if (!cohorts.has(key)) cohorts.set(key, new Set());
      cohorts.get(key)!.add(cId);
    });

    const sortedCohortKeys = Array.from(cohorts.keys()).sort();
    const maxPeriods = 6;

    return sortedCohortKeys.map(cohortKey => {
      const cohortCustomers = cohorts.get(cohortKey)!;
      const cohortStart = parseISO(`${cohortKey}-01`);
      const retention: (number | null)[] = [];

      for (let period = 0; period < maxPeriods; period++) {
        // Find how many cohort customers made a purchase in month [cohortMonth + period]
        const active = new Set<string>();
        invoices
          .filter(i => i.status === 'paid' && i.customerId && cohortCustomers.has(i.customerId))
          .forEach(inv => {
            const monthsDiff = differenceInMonths(parseISO(inv.date), cohortStart);
            if (monthsDiff === period) active.add(inv.customerId!);
          });

        const rate = cohortCustomers.size > 0 ? Math.round((active.size / cohortCustomers.size) * 100) : 0;
        retention.push(rate);
      }

      return {
        cohort: cohortKey,
        size: cohortCustomers.size,
        retention,
      };
    });
  }, [invoices]);

  const maxPeriods = 6;

  function retentionColor(pct: number | null) {
    if (pct === null) return 'bg-muted/20 text-muted-foreground';
    if (pct >= 70) return 'bg-green-600 text-white';
    if (pct >= 40) return 'bg-green-400 text-white';
    if (pct >= 20) return 'bg-yellow-400 text-black';
    if (pct > 0)   return 'bg-orange-400 text-white';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Cohort Analysis" />
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Cohort Analysis' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Retention by Cohort</CardTitle>
            <CardDescription>
              Each row shows the % of customers from a given month who made repeat purchases over 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {cohortData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Not enough data to build cohorts. Add paid invoices with customer IDs.</p>
            ) : (
              <table className="text-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-semibold">Cohort</th>
                    <th className="text-center p-2 font-semibold">Size</th>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                      <th key={`period-${i}`} className="text-center p-2 font-semibold min-w-[60px]">M+{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map(row => (
                    <tr key={row.cohort} className="border-t">
                      <td className="p-2 font-medium">{row.cohort}</td>
                      <td className="p-2 text-center text-muted-foreground">{row.size}</td>
                      {row.retention.map((pct, i) => (
                        <td key={`retention-${i}`} className="p-1">
                          <div className={cn('rounded text-center text-xs py-1 font-medium', retentionColor(pct))}>
                            {pct !== null ? `${pct}%` : '—'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 text-xs items-center">
          <span className="text-muted-foreground">Legend:</span>
          <span className="px-2 py-1 rounded bg-green-600 text-white">≥70% — Excellent</span>
          <span className="px-2 py-1 rounded bg-green-400 text-white">40–69% — Good</span>
          <span className="px-2 py-1 rounded bg-yellow-400 text-black">20–39% — Average</span>
          <span className="px-2 py-1 rounded bg-orange-400 text-white">1–19% — Low</span>
          <span className="px-2 py-1 rounded bg-red-100 text-red-700">0% — Churned</span>
        </div>
      </main>
    </div>
  );
}
