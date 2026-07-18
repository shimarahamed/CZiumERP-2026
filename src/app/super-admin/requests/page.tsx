'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePlatformData } from '@/hooks/use-platform-data';
import { createTenantWorkspace, rejectRegistrationRequest, INDUSTRY_TEMPLATES } from '@/lib/super-admin';
import type { RegistrationRequest, VerticalBlueprint } from '@/types';

export default function SuperAdminRequestsPage() {
  const { toast } = useToast();
  const { requests, blueprints } = usePlatformData();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Resolve a request to a blueprint: prefer its blueprintId, fall back to the
  // legacy industry (matching blueprint id or a synthetic one from the old
  // templates) so requests predating the blueprint engine still approve.
  const resolveBlueprint = (r: RegistrationRequest): VerticalBlueprint => {
    const wanted = r.blueprintId ?? r.industry ?? 'general';
    const found = blueprints.find(b => b.id === wanted);
    if (found) return found;
    const legacy = (r.industry ?? 'general');
    return {
      id: legacy, name: legacy,
      modules: INDUSTRY_TEMPLATES[legacy] ?? INDUSTRY_TEMPLATES.general,
    };
  };

  const pending = requests.filter(r => r.status === 'pending');
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const decided = requests.filter(r => r.status !== 'pending').slice(0, 20);

  const approve = async (r: RegistrationRequest) => {
    setBusyId(r.id);
    try {
      const slug = r.organizationName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await createTenantWorkspace({
        slug,
        displayName: r.organizationName,
        blueprint: resolveBlueprint(r),
        fromRequest: r,
      });
      toast({ title: 'Tenant created', description: `Workspace "${r.organizationName}" (${slug}) is live.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Could not create tenant' });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: RegistrationRequest) => {
    setBusyId(r.id);
    try {
      await rejectRegistrationRequest(r);
      toast({ title: 'Request rejected' });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Approve or reject organizations that registered from the login page.</p>
      </div>

      <div className="flex gap-2">
        <Badge variant={pending.length > 0 ? 'default' : 'secondary'}>{pending.length} pending</Badge>
        <Badge variant="secondary">{approvedCount} approved</Badge>
        <Badge variant="secondary">{rejectedCount} rejected</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending workspace requests</CardTitle>
          <CardDescription>Organizations that registered from the login page and are awaiting approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Contact</TableHead><TableHead>Industry</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pending requests.</TableCell></TableRow>
              ) : pending.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.organizationName}</TableCell>
                  <TableCell>{r.contactName} &lt;{r.contactEmail}&gt;</TableCell>
                  <TableCell className="capitalize">{r.blueprintId ?? r.industry ?? '—'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id}>Approve &amp; create</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(r)} disabled={busyId === r.id}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently decided</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {decided.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.organizationName}</TableCell>
                    <TableCell>{r.contactName} &lt;{r.contactEmail}&gt;</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
