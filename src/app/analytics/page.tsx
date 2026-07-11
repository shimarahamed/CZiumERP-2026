'use client';

import { useMemo } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { customerLifetimeValue, productProfitability, churnRisk, supplierPerformance } from '@/lib/analytics';
import { useReportRollups } from '@/hooks/use-report-rollups';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';
import { formatNumber } from '@/lib/money';

const REVENUE_TREND_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date', locked: true },
  { id: 'revenue', label: 'Revenue' },
  { id: 'grossMargin', label: 'Gross Margin' },
  { id: 'invoices', label: 'Invoices' },
];

function AnalyticsInner() {
  const { invoices, customers, vendors, currencySymbol, isDataLoaded, tenantId, currentStore } = useAppContext();
  // Pre-aggregated fast path for the trend chart — reads small daily rollup docs
  // instead of scanning every invoice. Falls back to "no trend yet" gracefully for
  // brand-new tenants with no rolled-up history (the scheduled function runs daily).
  const { rollups, isLoading: rollupsLoading } = useReportRollups(tenantId, currentStore?.id, 30);
  const revenueTrendColumnVisibility = useColumnVisibility('analytics-revenue-trend', REVENUE_TREND_COLUMNS);
  const { isVisible: isRevenueTrendVisible } = revenueTrendColumnVisibility;

  const clv = useMemo(() => {
    const m = customerLifetimeValue(invoices);
    return [...m.entries()]
      .map(([id, value]) => ({ id, name: customers.find(c => c.id === id)?.name ?? id, value }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
  }, [invoices, customers]);

  const profitability = useMemo(() => productProfitability(invoices).slice(0, 10), [invoices]);
  const churn = useMemo(() => churnRisk(invoices, customers, 90), [invoices, customers]);
  const suppliers = useMemo(() => supplierPerformance(vendors).slice(0, 10), [vendors]);

  if (!isDataLoaded) return null;

  return (
    <div className="flex flex-col h-full">
      <Header title="Advanced Analytics" />
      <main className="flex-1 overflow-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Revenue Trend (30 days)</CardTitle>
                <CardDescription>From pre-aggregated daily rollups — doesn&apos;t rescan invoice history on every load.</CardDescription>
              </div>
              <ColumnVisibilityMenu visibility={revenueTrendColumnVisibility} />
            </div>
          </CardHeader>
          <CardContent>
            {rollupsLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading…</p>
            ) : rollups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No rolled-up history yet — the daily rollup runs once a day, so this fills in over time.</p>
            ) : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead>
                  {isRevenueTrendVisible('revenue') && <TableHead className="text-right">Revenue</TableHead>}
                  {isRevenueTrendVisible('grossMargin') && <TableHead className="text-right">Gross Margin</TableHead>}
                  {isRevenueTrendVisible('invoices') && <TableHead className="text-right">Invoices</TableHead>}
                </TableRow></TableHeader>
                <TableBody>{rollups.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    {isRevenueTrendVisible('revenue') && <TableCell className="text-right font-medium">{currencySymbol} {formatNumber(r.revenue)}</TableCell>}
                    {isRevenueTrendVisible('grossMargin') && <TableCell className="text-right">{currencySymbol} {formatNumber(r.grossMargin)}</TableCell>}
                    {isRevenueTrendVisible('invoices') && <TableCell className="text-right">{r.invoiceCount}</TableCell>}
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Customer Lifetime Value</CardTitle><CardDescription>Top customers by total paid revenue.</CardDescription></CardHeader>
          <CardContent>
            {clv.length === 0 ? <p className="text-sm text-muted-foreground py-4">No paid invoices yet.</p> : (
              <Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">CLV</TableHead></TableRow></TableHeader>
                <TableBody>{clv.map(c => <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right font-medium">{currencySymbol} {formatNumber(c.value)}</TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Product Profitability</CardTitle><CardDescription>Revenue minus cost, top performers.</CardDescription></CardHeader>
          <CardContent>
            {profitability.length === 0 ? <p className="text-sm text-muted-foreground py-4">No sales data yet.</p> : (
              <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
                <TableBody>{profitability.map(p => <TableRow key={p.productId}><TableCell>{p.productName}</TableCell><TableCell className="text-right">{p.units}</TableCell><TableCell className="text-right font-medium">{currencySymbol} {formatNumber(p.profit)}</TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Churn Risk</CardTitle><CardDescription>Customers with no paid invoice in 90 days.</CardDescription></CardHeader>
          <CardContent>
            {churn.length === 0 ? <p className="text-sm text-muted-foreground py-4">No at-risk customers. 🎉</p> : (
              <div className="flex flex-wrap gap-2">{churn.slice(0, 20).map(c => <Badge key={c.id} variant="destructive">{c.name}</Badge>)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Supplier Performance</CardTitle><CardDescription>On-time and quality rates from vendor scorecards.</CardDescription></CardHeader>
          <CardContent>
            {suppliers.length === 0 ? <p className="text-sm text-muted-foreground py-4">No vendors yet.</p> : (
              <Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead className="text-right">On-time</TableHead><TableHead className="text-right">Quality</TableHead></TableRow></TableHeader>
                <TableBody>{suppliers.map(s => <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.onTime}%</TableCell><TableCell className="text-right">{s.quality}%</TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <AnalyticsInner />;
}
