

'use client';

import { usePageTitle } from '@/hooks/use-page-title';
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Area, AreaChart as ReAreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Pie, PieChart, Cell } from "recharts";
import Header from "@/components/Header";
import { DollarSign, Users, CreditCard, TrendingUp, PlusCircle, AlertCircle, AlertTriangle, Trophy, ShoppingBag, AreaChart, Hourglass, FileText, Settings, Clock } from "@/components/icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAppContext } from "@/context/AppContext";
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Invoice } from "@/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CardSkeleton } from "@/components/TableSkeleton";
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';
import { formatNumber } from '@/lib/money';

const DASHBOARD_DRILLDOWN_COLUMNS: ColumnDef[] = [
    { id: 'id', label: 'Invoice ID', locked: true },
    { id: 'customerName', label: 'Customer' },
    { id: 'date', label: 'Date' },
    { id: 'status', label: 'Status' },
    { id: 'amount', label: 'Amount' },
];

const statusVariant: { [key in Invoice['status']]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    paid: 'default',
    pending: 'secondary',
    overdue: 'destructive',
    refunded: 'outline',
    'partially-refunded': 'outline',
    'pending-approval': 'secondary',
};

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { invoices, currentStore, currencySymbol, products, user, stores, setUsers, isDataLoaded } = useAppContext();
  const [drilldownData, setDrilldownData] = useState<{ month: string, invoices: Invoice[] } | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const [hiddenWidgets, setHiddenWidgets] = useState(user?.dashboardSettings?.hiddenWidgets || []);
  const drilldownColumnVisibility = useColumnVisibility('dashboardDrilldown', DASHBOARD_DRILLDOWN_COLUMNS);
  const { isVisible: isDrilldownColVisible } = drilldownColumnVisibility;
  
  const { storeInvoices, paidInvoices, pendingInvoices } = useMemo(() => {
    const relevantInvoices = currentStore?.id === 'all' 
      ? invoices 
      : invoices.filter(i => i.storeId === currentStore?.id);
    
    const paid = relevantInvoices.filter(i => i.status === 'paid');
    const pending = relevantInvoices.filter(i => i.status === 'pending' || i.status === 'overdue');

    return { storeInvoices: relevantInvoices, paidInvoices: paid, pendingInvoices: pending };
  }, [invoices, currentStore]);
  
  const salesData = useMemo(() => {
    const sixMonthsAgo = startOfMonth(new Date(new Date().setMonth(new Date().getMonth() - 5)));
    
    // Filter invoices to the last 6 months first
    const recentPaidInvoices = paidInvoices.filter(inv => parseISO(inv.date) >= sixMonthsAgo);

    if (recentPaidInvoices.length === 0) {
        // Return a default structure for the last 6 months with 0 revenue
        const last6Months = eachMonthOfInterval({
            start: sixMonthsAgo,
            end: endOfMonth(new Date())
        });
        return last6Months.map(month => ({
            month: format(month, 'MMM'),
            revenue: 0,
        }));
    }

    const monthlySales = recentPaidInvoices.reduce((acc, inv) => {
      const month = format(parseISO(inv.date), 'MMM');
      acc[month] = (acc[month] || 0) + inv.amount;
      return acc;
    }, {} as Record<string, number>);

    // Ensure we have data for the last 6 months, even if it's 0
    const last6Months = eachMonthOfInterval({
        start: sixMonthsAgo,
        end: endOfMonth(new Date())
    });

    return last6Months.map(monthDate => {
        const monthName = format(monthDate, 'MMM');
        return {
            month: monthName,
            revenue: monthlySales[monthName] || 0,
        };
    });
}, [paidInvoices]);


  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  };

  const totalRevenue = useMemo(() => paidInvoices.reduce((sum, inv) => sum + inv.amount, 0), [paidInvoices]);

  const totalCost = useMemo(() => paidInvoices.reduce((total, invoice) => {
    return total + invoice.items.reduce((invoiceTotalCost, item) => {
      return invoiceTotalCost + (item.cost * item.quantity);
    }, 0);
  }, 0), [paidInvoices]);

  const totalProfit = useMemo(() => totalRevenue - totalCost, [totalRevenue, totalCost]);
  const profitMargin = useMemo(() => totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0, [totalProfit, totalRevenue]);
  
  const averageSaleValue = useMemo(() => paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0, [totalRevenue, paidInvoices.length]);
  const totalItemsSold = useMemo(() => paidInvoices.reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0), [paidInvoices]);
  const activeCustomers = useMemo(() => new Set(paidInvoices.map(inv => inv.customerId).filter(Boolean)).size, [paidInvoices]);

  const totalPendingAmount = useMemo(() => pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0), [pendingInvoices]);

  const topPerformingStore = useMemo(() => {
    if (currentStore?.id !== 'all' || paidInvoices.length === 0) {
      return null;
    }

    const salesByStore = new Map<string, { name: string, revenue: number }>();
    paidInvoices.forEach(invoice => {
        if (!invoice.storeId) return;
        const store = stores.find(s => s.id === invoice.storeId);
        if (!store) return;

        const existing = salesByStore.get(store.id);
        if (existing) {
            existing.revenue += invoice.amount;
        } else {
            salesByStore.set(store.id, { name: store.name, revenue: invoice.amount });
        }
    });

    if (salesByStore.size === 0) return null;

    return Array.from(salesByStore.values()).sort((a, b) => b.revenue - a.revenue)[0];
  }, [currentStore?.id, paidInvoices, stores]);


  const lowStockItems = useMemo(() => products.filter(p => 
    typeof p.reorderThreshold !== 'undefined' && p.stock <= p.reorderThreshold
  ), [products]);

  const expiringItems = useMemo(() => products
    .filter(p => {
      if (!p.expiryDate) return false;
      const expiry = parseISO(p.expiryDate);
      const daysUntilExpiry = differenceInDays(expiry, new Date());
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    })
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime()), [products]);

  const topProducts = useMemo(() => {
    const productSales = new Map<string, { id: string, name: string, quantity: number }>();
    paidInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const existing = productSales.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          productSales.set(item.productId, { id: item.productId, name: item.productName, quantity: item.quantity });
        }
      });
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [paidInvoices]);

  const recentInvoices = useMemo(() =>
    [...storeInvoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [storeInvoices]);

  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9'];
  const topProductsPie = useMemo(() => topProducts.map((p, i) => ({ ...p, fill: PIE_COLORS[i % PIE_COLORS.length] })), [topProducts]);

  const canCreatePo = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'inventory-staff';
  const kpiSubtitle = currentStore?.id === 'all' ? "Across all stores" : "For this store's paid invoices";

  const handleBarClick = (data: any) => {
    if (!data || !data.activePayload) return;
    const monthIndex = data.activeTooltipIndex;
    const monthName = salesData[monthIndex].month;

    const relevantInvoices = storeInvoices.filter(
      (invoice) => format(parseISO(invoice.date), 'MMM') === monthName
    );

    setDrilldownData({ month: monthName, invoices: relevantInvoices });
  };
  
  const handleToggleWidget = (widgetId: string, checked: boolean) => {
    setHiddenWidgets(prev => 
      checked ? prev.filter(id => id !== widgetId) : [...prev, widgetId]
    );
  };
  
  const handleSaveChanges = () => {
    if (user) {
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === user.id 
            ? { ...u, dashboardSettings: { hiddenWidgets } } 
            : u
        )
      );
      toast({ title: 'Dashboard layout saved!' });
      setIsCustomizeOpen(false);
    }
  };

  const kpiCard = (title: string, value: string, subtitle: string, Icon: any, tint: string) => (
    <Card className="border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${tint} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );

  const dashboardWidgets = [
    { id: 'totalRevenue', title: 'Total Revenue', Component: () => kpiCard('Total Revenue', `${currencySymbol} ${formatNumber(totalRevenue)}`, kpiSubtitle, DollarSign, 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400') },
    { id: 'totalProfit', title: 'Total Profit', Component: () => kpiCard('Total Profit', `${currencySymbol} ${formatNumber(totalProfit)}`, `${formatNumber(profitMargin, 1, 1)}% profit margin`, TrendingUp, 'bg-violet-500/10 text-violet-600 dark:text-violet-400') },
    { id: 'avgSaleValue', title: 'Average Sale Value', Component: () => kpiCard('Average Sale Value', `${currencySymbol} ${formatNumber(averageSaleValue)}`, kpiSubtitle, AreaChart, 'bg-sky-500/10 text-sky-600 dark:text-sky-400') },
    { id: 'totalSales', title: 'Total Sales', Component: () => kpiCard('Total Sales', `+${paidInvoices.length}`, kpiSubtitle, CreditCard, 'bg-amber-500/10 text-amber-600 dark:text-amber-400') },
    { id: 'itemsSold', title: 'Items Sold', Component: () => kpiCard('Items Sold', `${totalItemsSold}`, kpiSubtitle, ShoppingBag, 'bg-rose-500/10 text-rose-600 dark:text-rose-400') },
    { id: 'activeCustomers', title: 'Active Customers', Component: () => kpiCard('Active Customers', `+${activeCustomers}`, 'Customers with paid invoices', Users, 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400') },
    { id: 'pendingPayments', title: 'Pending Payments', Component: () => kpiCard('Pending Payments', `${currencySymbol} ${formatNumber(totalPendingAmount)}`, `From ${pendingInvoices.length} invoices`, Hourglass, 'bg-orange-500/10 text-orange-600 dark:text-orange-400') },
    ...(topPerformingStore ? [{ id: 'topStore', title: 'Top Performing Store', Component: () => kpiCard('Top Performing Store', topPerformingStore.name, `${currencySymbol} ${formatNumber(topPerformingStore.revenue)} in revenue`, Trophy, 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400') }] : []),
    { id: 'salesOverview', title: 'Sales Overview Chart', Component: () => (
      <Card className="lg:col-span-4 border shadow-none">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <p className="text-sm text-muted-foreground">Last 6 months — click a point to drill down</p>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ReAreaChart data={salesData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }} onClick={handleBarClick}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${currencySymbol} ${value / 1000}k`} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Legend content={<ChartLegendContent />} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueFill)" className="cursor-pointer" activeDot={{ r: 4 }} />
            </ReAreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    )},
    { id: 'topProductsChart', title: 'Top Products Chart', Component: () => (
      <Card className="lg:col-span-3 border shadow-none">
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <p className="text-sm text-muted-foreground">By quantity sold</p>
        </CardHeader>
        <CardContent>
          {topProductsPie.length === 0 ? (
            <div className="flex items-center justify-center h-[220px]"><p className="text-sm text-muted-foreground">No sales data yet.</p></div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                <Pie data={topProductsPie} dataKey="quantity" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {topProductsPie.map((entry, i) => <Cell key={entry.id} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          <div className="space-y-1.5 mt-2">
            {topProductsPie.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: item.fill }} />{item.name}</span>
                <span className="font-medium text-muted-foreground">{item.quantity} sold</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )},
    { id: 'dashboardInsights', title: 'Dashboard Insights', Component: () => (<Card className="lg:col-span-4 border shadow-none"><CardHeader><CardTitle>Dashboard Insights</CardTitle><p className="text-sm text-muted-foreground">Key metrics and alerts for your business.</p></CardHeader><CardContent><div className="space-y-4 max-h-[250px] overflow-y-auto">{lowStockItems.length === 0 && expiringItems.length === 0 ? (<div className="flex items-center justify-center h-full"><p className="text-sm text-muted-foreground text-center py-8">No alerts at the moment.</p></div>) : (<>{lowStockItems.length > 0 && (<div><h4 className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive"/>Low Stock Items</h4><div className="space-y-2 text-sm">{lowStockItems.map(item => (<div key={item.id} className="flex justify-between items-center"><span>{item.name}</span><div className="flex items-center gap-2"><span className="font-medium text-destructive">{item.stock} left</span>{canCreatePo && item.vendorId && (<Button asChild variant="outline" size="sm" className="h-7"><Link href={`/purchase-orders?action=new&productId=${item.id}&vendorId=${item.vendorId}`}>Reorder</Link></Button>)}</div></div>))}</div></div>)}{expiringItems.length > 0 && (<div className="pt-2"><h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500"/>Expiring Soon</h4><div className="space-y-2 text-sm">{expiringItems.map(item => (<div key={item.id} className="flex justify-between items-center"><span>{item.name}</span>{item.expiryDate && <span className="font-medium">{format(parseISO(item.expiryDate), 'MMM d, yyyy')}</span>}</div>))}</div></div>)}</>)}</div></CardContent></Card>)},
    { id: 'recentActivity', title: 'Recent Activity', Component: () => (
      <Card className="lg:col-span-3 border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Latest invoices recorded</p>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="flex items-center justify-center h-[150px]"><p className="text-sm text-muted-foreground">No invoices yet.</p></div>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm border-b border-dashed pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.customerName || inv.id}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(inv.date), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusVariant[inv.status]} className="capitalize">{inv.status.replace('-', ' ')}</Badge>
                    <span className="font-semibold">{currencySymbol} {formatNumber(inv.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )},
  ];

  const MAIN_WIDGET_IDS = ['salesOverview', 'topProductsChart', 'dashboardInsights', 'recentActivity'];
  const visibleWidgets = dashboardWidgets.filter(w => !hiddenWidgets.includes(w.id));
  const kpiWidgets = visibleWidgets.filter(w => !MAIN_WIDGET_IDS.includes(w.id));
  const mainWidgets = visibleWidgets.filter(w => MAIN_WIDGET_IDS.includes(w.id));

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsCustomizeOpen(true)}>
            <Settings className="h-4 w-4" />
            Customize
        </Button>
        <Button asChild size="sm" className="gap-1">
          <Link href="/pos">
            <CreditCard className="h-4 w-4" />
            Point of Sale
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href="/invoices?action=new">
            <PlusCircle className="h-4 w-4" />
            Create New Sale
          </Link>
        </Button>
      </Header>
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/20">
        {!isDataLoaded ? (
          <>
            <CardSkeleton count={4} />
            <div className="mt-6"><CardSkeleton count={2} /></div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {kpiWidgets.map(widget => <widget.Component key={widget.id} />)}
            </div>
            <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-7">
              {mainWidgets.map(widget => <widget.Component key={widget.id} />)}
            </div>
          </>
        )}
      </main>
      <Dialog open={!!drilldownData} onOpenChange={() => setDrilldownData(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sales for {drilldownData?.month}</DialogTitle>
            <DialogDescription>
              Showing all invoices recorded in {drilldownData?.month}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <ColumnVisibilityMenu visibility={drilldownColumnVisibility} />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice ID</TableHead>
                  {isDrilldownColVisible('customerName') && <TableHead>Customer</TableHead>}
                  {isDrilldownColVisible('date') && <TableHead>Date</TableHead>}
                  {isDrilldownColVisible('status') && <TableHead>Status</TableHead>}
                  {isDrilldownColVisible('amount') && <TableHead className="text-right">Amount</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {drilldownData?.invoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    {isDrilldownColVisible('customerName') && <TableCell>{invoice.customerName || "N/A"}</TableCell>}
                    {isDrilldownColVisible('date') && <TableCell>{format(parseISO(invoice.date), 'yyyy-MM-dd')}</TableCell>}
                    {isDrilldownColVisible('status') && (
                    <TableCell>
                      <Badge variant={statusVariant[invoice.status]} className="capitalize">{invoice.status.replace('-', ' ')}</Badge>
                    </TableCell>
                    )}
                    {isDrilldownColVisible('amount') && <TableCell className="text-right">{currencySymbol} {formatNumber(invoice.amount)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
            <DialogDescription>Select the widgets you want to see on your dashboard.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {dashboardWidgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between p-2 border rounded-md">
                <Label htmlFor={`widget-${widget.id}`} className="font-medium">{widget.title}</Label>
                <Switch 
                  id={`widget-${widget.id}`}
                  checked={!hiddenWidgets.includes(widget.id)}
                  onCheckedChange={(checked) => handleToggleWidget(widget.id, checked)}
                />
              </div>
            ))}
          </div>
           <Button onClick={handleSaveChanges}>Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

