'use client';

import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { usePlatformData } from '@/hooks/use-platform-data';
import { ALL_MODULES } from '@/lib/super-admin';
import type { Tenant, Module } from '@/types';

const adoptionConfig = {
  allowed: { label: 'Allowed', color: 'hsl(var(--chart-2))' },
  enabled: { label: 'Enabled', color: 'hsl(var(--chart-1))' },
};

export default function SuperAdminModulesPage() {
  const { toast } = useToast();
  const { tenants } = usePlatformData();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const adoptionData = useMemo(() =>
    ALL_MODULES.map(m => ({
      module: m,
      allowed: tenants.filter(t => t.allowedModules?.includes(m)).length,
      enabled: tenants.filter(t => t.enabledModules?.includes(m)).length,
    })), [tenants]);

  const toggleAllowed = async (tenant: Tenant, m: Module, allow: boolean) => {
    const key = `${tenant.id}:${m}`;
    setBusyKey(key);
    try {
      const allowedModules = allow
        ? [...new Set([...(tenant.allowedModules ?? []), m])]
        : (tenant.allowedModules ?? []).filter(x => x !== m);
      // enabledModules must stay within the allowance
      const enabledModules = allow
        ? (tenant.enabledModules ?? [])
        : (tenant.enabledModules ?? []).filter(x => x !== m);
      await updateDoc(doc(db, 'tenants', tenant.id), { allowedModules, enabledModules });
      toast({ title: allow ? 'Module allowed' : 'Module revoked', description: `${m} — ${tenant.name}` });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module adoption</CardTitle>
          <CardDescription>How many tenants are allowed each module vs. how many have switched it on.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={adoptionConfig} className="h-[280px] w-full">
            <BarChart data={adoptionData} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} hide />
              <YAxis dataKey="module" type="category" tickLine={false} axisLine={false} tickMargin={4} width={150} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="allowed" fill="var(--color-allowed)" radius={4} barSize={10}>
                <LabelList dataKey="allowed" position="right" className="fill-foreground text-xs" />
              </Bar>
              <Bar dataKey="enabled" fill="var(--color-enabled)" radius={4} barSize={10}>
                <LabelList dataKey="enabled" position="right" className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module allowance matrix</CardTitle>
          <CardDescription>
            Checkbox = module allowed for the tenant (their plan). A filled dot means the tenant admin currently has it enabled.
            Revoking an allowed module also switches it off for the tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-36">Tenant</TableHead>
                  {ALL_MODULES.map(m => (
                    <TableHead key={m} className="text-center text-xs whitespace-nowrap">{m.replace(' & ', ' & ')}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow><TableCell colSpan={ALL_MODULES.length + 1} className="text-center text-muted-foreground py-8">No tenants yet.</TableCell></TableRow>
                ) : tenants.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium whitespace-nowrap">{t.name}</TableCell>
                    {ALL_MODULES.map(m => {
                      const allowed = t.allowedModules?.includes(m) ?? false;
                      const enabled = t.enabledModules?.includes(m) ?? false;
                      return (
                        <TableCell key={m} className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Checkbox
                              checked={allowed}
                              disabled={busyKey === `${t.id}:${m}`}
                              onCheckedChange={(c) => toggleAllowed(t, m, c === true)}
                              aria-label={`${m} allowed for ${t.name}`}
                            />
                            <span
                              className={enabled ? 'inline-block w-2 h-2 rounded-full bg-primary' : 'inline-block w-2 h-2 rounded-full bg-muted'}
                              title={enabled ? 'Enabled by tenant' : 'Not enabled'}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
