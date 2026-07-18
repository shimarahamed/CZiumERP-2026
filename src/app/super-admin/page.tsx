'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { usePlatformData } from '@/hooks/use-platform-data';
import { usePlatformUsers } from '@/hooks/use-platform-users';
import { Building2, Users, Inbox, PauseCircle } from '@/components/icons';

const growthConfig = { tenants: { label: 'Tenants', color: 'hsl(var(--chart-1))' } };
const industryConfig = { count: { label: 'Tenants', color: 'hsl(var(--chart-1))' } };

export default function SuperAdminOverviewPage() {
  const { tenants, requests, isLoaded } = usePlatformData();
  const { users } = usePlatformUsers(tenants);

  const activeTenants = tenants.filter(t => t.status === 'active');
  const suspendedTenants = tenants.filter(t => t.status === 'suspended');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  // Cumulative tenant count by month, from createdAt
  const growthData = useMemo(() => {
    const byMonth = new Map<string, number>();
    tenants.forEach(t => {
      const month = (t.createdAt ?? '').slice(0, 7);
      if (month) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    });
    const months = [...byMonth.keys()].sort();
    let running = 0;
    return months.map(m => {
      running += byMonth.get(m) ?? 0;
      return { month: m, tenants: running };
    });
  }, [tenants]);

  const industryData = useMemo(() => {
    const counts = new Map<string, number>();
    tenants.forEach(t => {
      const key = t.industry ?? 'general';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count);
  }, [tenants]);

  const stats = [
    { label: 'Active tenants', value: activeTenants.length, icon: Building2, href: '/super-admin/tenants' },
    { label: 'Total users', value: users.length, icon: Users, href: '/super-admin/users' },
    { label: 'Pending requests', value: pendingRequests.length, icon: Inbox, href: '/super-admin/requests' },
    { label: 'Suspended tenants', value: suspendedTenants.length, icon: PauseCircle, href: '/super-admin/tenants' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">A snapshot of every workspace, user, and request on the platform.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-primary/60 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <div className="p-1.5 rounded-md bg-primary/10">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight">{isLoaded ? s.value : '—'}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant growth</CardTitle>
            <CardDescription>Cumulative workspaces on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {growthData.length > 0 ? (
              <ChartContainer config={growthConfig} className="h-[240px] w-full">
                <AreaChart data={growthData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={32} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Area dataKey="tenants" type="monotone" stroke="var(--color-tenants)" strokeWidth={2} fill="var(--color-tenants)" fillOpacity={0.12} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No tenants yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenants by industry</CardTitle>
            <CardDescription>Which templates client workspaces use.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {industryData.length > 0 ? (
              <ChartContainer config={industryConfig} className="h-[240px] w-full">
                <BarChart data={industryData} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} hide />
                  <YAxis dataKey="industry" type="category" tickLine={false} axisLine={false} tickMargin={4} width={96} className="capitalize" />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={18}>
                    <LabelList dataKey="count" position="right" className="fill-foreground text-xs" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No tenants yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting approval</CardTitle>
            <CardDescription>Organizations that registered from the login page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/40 transition-colors">
                <div>
                  <p className="text-sm font-medium">{r.organizationName}</p>
                  <p className="text-xs text-muted-foreground">{r.contactName} &lt;{r.contactEmail}&gt;</p>
                </div>
                <Badge variant="secondary" className="capitalize">{r.industry}</Badge>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link href="/super-admin/requests">Review requests</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
