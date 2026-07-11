'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import { CSVExportButton } from '@/components/CSVExportButton';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';
import { formatNumber, lineTotal } from '@/lib/money';

const PRODUCT_PROFITABILITY_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Product', locked: true },
  { id: 'qty', label: 'Units Sold' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'cogs', label: 'COGS' },
  { id: 'profit', label: 'Gross Profit' },
  { id: 'margin', label: 'Margin' },
];

const PROJECT_PROFITABILITY_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Project', locked: true },
  { id: 'client', label: 'Client' },
  { id: 'status', label: 'Status' },
  { id: 'budget', label: 'Budget' },
];

export default function ProfitabilityPage() {
  const { invoices, products, projects, currencySymbol } = useAppContext();
  const [tab, setTab] = useState<'product' | 'project'>('product');
  const productColumnVisibility = useColumnVisibility('profitability-product', PRODUCT_PROFITABILITY_COLUMNS);
  const { isVisible: isProductVisible } = productColumnVisibility;
  const projectColumnVisibility = useColumnVisibility('profitability-project', PROJECT_PROFITABILITY_COLUMNS);
  const { isVisible: isProjectVisible } = projectColumnVisibility;

  const productProfitability = useMemo(() => {
    const map = new Map<string, { id: string; name: string; revenue: number; cogs: number; qty: number }>();
    invoices.filter(i => i.status === 'paid').forEach(inv => {
      inv.items.forEach(item => {
        const existing = map.get(item.productId) ?? { id: item.productId, name: item.productName, revenue: 0, cogs: 0, qty: 0 };
        existing.revenue += lineTotal(item.price, item.quantity, item.discount, item.discountType);
        existing.cogs += item.cost * item.quantity;
        existing.qty += item.quantity;
        map.set(item.productId, existing);
      });
    });
    return Array.from(map.values())
      .map(p => ({ ...p, profit: p.revenue - p.cogs, margin: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [invoices]);

  const projectProfitability = useMemo(() => {
    return projects.map(p => {
      const budget = p.budget ?? 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        budget,
        client: p.client ?? '—',
        profit: budget,
        margin: 100,
      };
    }).sort((a, b) => b.budget - a.budget);
  }, [projects]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Profitability Report" />
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Profitability' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs value={tab} onValueChange={v => setTab(v as 'product' | 'project')}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="product">By Product</TabsTrigger>
              <TabsTrigger value="project">By Project</TabsTrigger>
            </TabsList>
            {tab === 'product' && (
              <>
                <CSVExportButton
                  data={productProfitability as Record<string, unknown>[]}
                  filename="product-profitability"
                  columns={[
                    { key: 'name', label: 'Product' },
                    { key: 'qty', label: 'Units Sold' },
                    { key: 'revenue', label: 'Revenue' },
                    { key: 'cogs', label: 'COGS' },
                    { key: 'profit', label: 'Gross Profit' },
                    { key: 'margin', label: 'Margin %' },
                  ]}
                />
                <ColumnVisibilityMenu visibility={productColumnVisibility} />
              </>
            )}
            {tab === 'project' && (
              <>
                <CSVExportButton
                  data={projectProfitability as Record<string, unknown>[]}
                  filename="project-profitability"
                  columns={[
                    { key: 'name', label: 'Project' },
                    { key: 'client', label: 'Client' },
                    { key: 'status', label: 'Status' },
                    { key: 'budget', label: 'Budget' },
                  ]}
                />
                <ColumnVisibilityMenu visibility={projectColumnVisibility} />
              </>
            )}
          </div>

          <TabsContent value="product">
            <Card>
              <CardHeader>
                <CardTitle>Product Profitability</CardTitle>
                <CardDescription>Revenue minus COGS from paid invoices, sorted by gross profit.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      {isProductVisible('qty') && <TableHead className="text-right">Units Sold</TableHead>}
                      {isProductVisible('revenue') && <TableHead className="text-right">Revenue</TableHead>}
                      {isProductVisible('cogs') && <TableHead className="text-right">COGS</TableHead>}
                      {isProductVisible('profit') && <TableHead className="text-right">Gross Profit</TableHead>}
                      {isProductVisible('margin') && <TableHead className="text-right">Margin</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productProfitability.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No paid invoices yet.</TableCell></TableRow>
                    ) : productProfitability.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        {isProductVisible('qty') && <TableCell className="text-right">{p.qty}</TableCell>}
                        {isProductVisible('revenue') && <TableCell className="text-right">{currencySymbol} {formatNumber(p.revenue)}</TableCell>}
                        {isProductVisible('cogs') && <TableCell className="text-right text-muted-foreground">{currencySymbol} {formatNumber(p.cogs)}</TableCell>}
                        {isProductVisible('profit') && <TableCell className="text-right font-semibold">{currencySymbol} {formatNumber(p.profit)}</TableCell>}
                        {isProductVisible('margin') && (
                          <TableCell className="text-right">
                            <Badge variant={p.margin >= 30 ? 'default' : p.margin >= 10 ? 'secondary' : 'destructive'}>
                              {formatNumber(p.margin, 1, 1)}%
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="project">
            <Card>
              <CardHeader>
                <CardTitle>Project Profitability</CardTitle>
                <CardDescription>Budget allocated per project.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      {isProjectVisible('client') && <TableHead>Client</TableHead>}
                      {isProjectVisible('status') && <TableHead>Status</TableHead>}
                      {isProjectVisible('budget') && <TableHead className="text-right">Budget</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectProfitability.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No projects yet.</TableCell></TableRow>
                    ) : projectProfitability.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        {isProjectVisible('client') && <TableCell>{p.client}</TableCell>}
                        {isProjectVisible('status') && (
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{p.status.replace('-', ' ')}</Badge>
                          </TableCell>
                        )}
                        {isProjectVisible('budget') && <TableCell className="text-right">{currencySymbol} {formatNumber(p.budget)}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
