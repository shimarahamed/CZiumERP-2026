"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAppContext } from "@/context/AppContext";
import { format, parseISO, startOfMonth, endOfMonth, startOfDay, isWithinInterval, subMonths, eachMonthOfInterval } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
} from "recharts";
import { formatNumber, lineTotal } from "@/lib/money";

type Trend = "up" | "down";

interface StatTile {
  id: string;
  label: string;
  value: string;
  trend: Trend;
  change: string;
  subtitle: string;
}

const CATEGORY_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.15)",
];

const chartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  sales: { label: "Sales Count", color: "hsl(var(--primary) / 0.5)" },
};

function pctChange(current: number, previous: number): { trend: Trend; change: string } {
  if (previous === 0) {
    return current > 0 ? { trend: "up", change: "+100%" } : { trend: "up", change: "0%" };
  }
  const pct = ((current - previous) / previous) * 100;
  return { trend: pct >= 0 ? "up" : "down", change: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` };
}

function StatTileCard({ tile }: { tile: StatTile }) {
  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <h4 className="text-2xl font-bold text-foreground">{tile.value}</h4>
        <div className="flex items-end justify-between mt-4 sm:mt-5">
          <p className="text-sm text-muted-foreground">{tile.label}</p>
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                tile.trend === "up"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-500"
                  : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-500"
              }`}
            >
              {tile.change}
            </span>
            <span className="text-xs text-muted-foreground">{tile.subtitle}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatisticsChart({ monthlyData, currencySymbol }: { monthlyData: { month: string; revenue: number; sales: number }[]; currencySymbol: string }) {
  const [range, setRange] = useState<"monthly" | "quarterly" | "annually">("monthly");

  const data = useMemo(() => {
    if (range === "monthly") return monthlyData;
    if (range === "quarterly") {
      const quarters = [monthlyData.slice(0, 3), monthlyData.slice(3, 6), monthlyData.slice(6, 9), monthlyData.slice(9, 12)].filter(q => q.length > 0);
      return quarters.map((q, i) => ({
        month: `Q${i + 1}`,
        revenue: q.reduce((s, m) => s + m.revenue, 0),
        sales: q.reduce((s, m) => s + m.sales, 0),
      }));
    }
    return [
      {
        month: "This Year",
        revenue: monthlyData.reduce((s, m) => s + m.revenue, 0),
        sales: monthlyData.reduce((s, m) => s + m.sales, 0),
      },
    ];
  }, [range, monthlyData]);

  const avgMonthlyRevenue = useMemo(
    () => (monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.revenue, 0) / monthlyData.length : 0),
    [monthlyData]
  );

  const { trend: momTrend, change: momChange } = useMemo(() => {
    const last = monthlyData[monthlyData.length - 1]?.revenue ?? 0;
    const prev = monthlyData[monthlyData.length - 2]?.revenue ?? 0;
    return pctChange(last, prev);
  }, [monthlyData]);

  return (
    <Card className="lg:col-span-8">
      <CardHeader className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Statistics</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Revenue and sales over the last 12 months</p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["monthly", "quarterly", "annually"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`w-full rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-9 mb-4">
          <div className="flex items-start gap-2">
            <div>
              <h4 className="text-xl font-bold text-foreground">{currencySymbol} {avgMonthlyRevenue.toFixed(2)}</h4>
              <span className="text-xs text-muted-foreground">Avg. Monthly Revenue</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div>
              <h4 className="text-xl font-bold text-foreground">{currencySymbol} {(monthlyData[monthlyData.length - 1]?.revenue ?? 0).toFixed(2)}</h4>
              <span className="text-xs text-muted-foreground">This Month</span>
            </div>
            <span
              className={`mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                momTrend === "up"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-500"
                  : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-500"
              }`}
            >
              {momChange}
            </span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `${currencySymbol}${v >= 1000 ? `${v / 1000}k` : v}`} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="url(#fillRevenue)" strokeWidth={2} />
            <Area type="monotone" dataKey="sales" stroke="var(--color-sales)" fill="url(#fillSales)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MonthlyGoalCard({ currencySymbol, thisMonthRevenue, lastMonthRevenue, monthLabel }: { currencySymbol: string; thisMonthRevenue: number; lastMonthRevenue: number; monthLabel: string }) {
  const goal = lastMonthRevenue > 0 ? lastMonthRevenue : thisMonthRevenue || 1;
  const progress = Math.min(100, Math.round((thisMonthRevenue / goal) * 100));
  const goalData = [{ name: `${monthLabel} Goal`, value: progress, fill: "hsl(var(--primary))" }];

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-lg">Revenue Goal</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">This month vs. last month&apos;s revenue</p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ChartContainer config={{}} className="h-[180px] w-full">
            <RadialBarChart data={goalData} innerRadius="75%" outerRadius="100%" startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={999} background />
            </RadialBarChart>
          </ChartContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold text-foreground">{progress}%</span>
            <span className="mt-1 text-xs text-muted-foreground">{monthLabel} Goal</span>
          </div>
        </div>
        <div className="mt-6 space-y-5 border-t pt-6">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">This Month</p>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{currencySymbol} {thisMonthRevenue.toFixed(2)}</p>
              <div className="flex w-full max-w-[140px] items-center gap-3">
                <div className="relative block h-2 w-full max-w-[100px] rounded-sm bg-muted">
                  <div className="absolute left-0 top-0 h-full rounded-sm bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{progress}%</p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Last Month</p>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{currencySymbol} {lastMonthRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesCategoryCard({ categories, currencySymbol }: { categories: { name: string; value: number; count: number; fill: string }[]; currencySymbol: string }) {
  const total = categories.reduce((sum, c) => sum + c.value, 0);

  return (
    <Card className="lg:col-span-6">
      <CardHeader>
        <CardTitle className="text-lg">Sales by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No paid sales yet to categorize.</p>
        ) : (
          <div className="flex flex-col items-center gap-8 xl:flex-row">
            <div className="relative shrink-0">
              <ChartContainer config={{}} className="h-[220px] w-[220px]">
                <PieChart>
                  <Pie data={categories} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={2} strokeWidth={2}>
                    {categories.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-sm text-muted-foreground">{currencySymbol} {total.toFixed(0)}</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-6 sm:flex-row xl:flex-col">
              {categories.map((c) => (
                <div key={c.name} className="flex items-start gap-2.5">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.fill }} />
                  <div>
                    <h5 className="mb-1 text-sm font-medium text-foreground">{c.name}</h5>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{total > 0 ? ((c.value / total) * 100).toFixed(0) : 0}%</p>
                      <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                      <p>{c.count} sold</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSalesCard({ invoices, currencySymbol }: { invoices: { id: string; customerName?: string; date: string; amount: number; status: string }[]; currencySymbol: string }) {
  return (
    <Card className="lg:col-span-6">
      <CardHeader>
        <CardTitle className="text-lg">Recent Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[500px] flex flex-col gap-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50">
                  <div>
                    <span className="block text-sm font-medium text-foreground">{inv.customerName || "Walk-in Customer"}</span>
                    <span className="text-xs text-muted-foreground">{format(parseISO(inv.date), "MMM d, yyyy")} &middot; {inv.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-semibold text-foreground">{currencySymbol} {inv.amount.toFixed(2)}</span>
                    <span className="text-xs capitalize text-muted-foreground">{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const { invoices, products, currentStore, currencySymbol } = useAppContext();

  const storeInvoices = useMemo(
    () => (currentStore?.id === "all" ? invoices : invoices.filter((i) => i.storeId === currentStore?.id)),
    [invoices, currentStore]
  );

  const paidInvoices = useMemo(() => storeInvoices.filter((i) => i.status === "paid"), [storeInvoices]);

  const today = startOfDay(new Date());
  const todaysInvoices = useMemo(
    () => paidInvoices.filter((inv) => startOfDay(parseISO(inv.date)).getTime() === today.getTime()),
    [paidInvoices, today]
  );
  const todaysRevenue = useMemo(() => todaysInvoices.reduce((sum, inv) => sum + inv.amount, 0), [todaysInvoices]);

  const prevDayInvoices = useMemo(() => {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    return paidInvoices.filter((inv) => startOfDay(parseISO(inv.date)).getTime() === yest.getTime());
  }, [paidInvoices, today]);
  const prevDayRevenue = useMemo(() => prevDayInvoices.reduce((sum, inv) => sum + inv.amount, 0), [prevDayInvoices]);

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const thisMonthInvoices = useMemo(
    () => paidInvoices.filter((inv) => isWithinInterval(parseISO(inv.date), { start: monthStart, end: monthEnd })),
    [paidInvoices, monthStart, monthEnd]
  );
  const thisMonthRevenue = useMemo(() => thisMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0), [thisMonthInvoices]);

  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  const lastMonthInvoices = useMemo(
    () => paidInvoices.filter((inv) => isWithinInterval(parseISO(inv.date), { start: lastMonthStart, end: lastMonthEnd })),
    [paidInvoices, lastMonthStart, lastMonthEnd]
  );
  const lastMonthRevenue = useMemo(() => lastMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0), [lastMonthInvoices]);

  const monthlyData = useMemo(() => {
    const elevenMonthsAgo = startOfMonth(subMonths(today, 11));
    const months = eachMonthOfInterval({ start: elevenMonthsAgo, end: today });
    return months.map((monthDate) => {
      const label = format(monthDate, "MMM");
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const monthInvoices = paidInvoices.filter((inv) => isWithinInterval(parseISO(inv.date), { start, end }));
      return {
        month: label,
        revenue: monthInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        sales: monthInvoices.length,
      };
    });
  }, [paidInvoices, today]);

  const categories = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    paidInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        const categoryName = product?.category || "Uncategorized";
        const existing = map.get(categoryName) ?? { value: 0, count: 0 };
        existing.value += lineTotal(item.price, item.quantity, item.discount, item.discountType);
        existing.count += item.quantity;
        map.set(categoryName, existing);
      });
    });
    return Array.from(map.entries())
      .map(([name, { value, count }]) => ({ name, value, count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((c, i) => ({ ...c, fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
  }, [paidInvoices, products]);

  const recentSales = useMemo(
    () =>
      [...paidInvoices]
        .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))
        .slice(0, 6)
        .map((inv) => ({ id: inv.id, customerName: inv.customerName, date: inv.date, amount: inv.amount, status: inv.status })),
    [paidInvoices]
  );

  const { trend: todayTrend, change: todayChange } = pctChange(todaysRevenue, prevDayRevenue);
  const { trend: revenueTrend, change: revenueChange } = pctChange(thisMonthRevenue, lastMonthRevenue);
  const { trend: countTrend, change: countChange } = pctChange(thisMonthInvoices.length, lastMonthInvoices.length);

  const statTiles: StatTile[] = [
    { id: "todaysSales", label: "Today's Sales", value: `${currencySymbol} ${todaysRevenue.toFixed(2)}`, trend: todayTrend, change: todayChange, subtitle: "vs. yesterday" },
    { id: "monthRevenue", label: "This Month's Revenue", value: `${currencySymbol} ${thisMonthRevenue.toFixed(2)}`, trend: revenueTrend, change: revenueChange, subtitle: "vs. last month" },
    { id: "monthSales", label: "Sales This Month", value: `${thisMonthInvoices.length}`, trend: countTrend, change: countChange, subtitle: "vs. last month" },
  ];

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {statTiles.map((tile) => (
          <StatTileCard key={tile.id} tile={tile} />
        ))}
      </div>

      <div className="col-span-12 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
        <StatisticsChart monthlyData={monthlyData} currencySymbol={currencySymbol} />
        <MonthlyGoalCard currencySymbol={currencySymbol} thisMonthRevenue={thisMonthRevenue} lastMonthRevenue={lastMonthRevenue} monthLabel={format(today, "MMMM")} />
      </div>

      <div className="col-span-12 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
        <SalesCategoryCard categories={categories} currencySymbol={currencySymbol} />
        <RecentSalesCard invoices={recentSales} currencySymbol={currencySymbol} />
      </div>
    </div>
  );
}
