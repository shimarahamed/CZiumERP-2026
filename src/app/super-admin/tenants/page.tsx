'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePlatformData } from '@/hooks/use-platform-data';
import { ALL_MODULES, slugify, createTenantWorkspace, setTenantStatus } from '@/lib/super-admin';
import { TenantDetailSheet } from '@/components/super-admin/TenantDetailSheet';
import type { Tenant, Module, VerticalBlueprint } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const TENANTS_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'id', label: 'ID' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'modules', label: 'Modules' },
  { id: 'status', label: 'Status' },
];

export default function SuperAdminTenantsPage() {
  const { toast } = useToast();
  const { tenants, blueprints } = usePlatformData();
  const columnVisibility = useColumnVisibility('tenants', TENANTS_COLUMNS);
  const { isVisible } = columnVisibility;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [modules, setModules] = useState<Module[]>(ALL_MODULES);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const activeBlueprints = blueprints.filter(b => b.isActive !== false);
  const selectedBlueprint = blueprints.find(b => b.id === blueprintId);

  const applyBlueprint = (id: string) => {
    setBlueprintId(id);
    const bp = blueprints.find(b => b.id === id);
    if (bp) setModules(bp.modules);
  };

  const handleCreate = async () => {
    const slug = slugify(tenantSlug);
    if (!slug || !name) {
      toast({ variant: 'destructive', title: 'Name and ID are required' });
      return;
    }
    if (!selectedBlueprint) {
      toast({ variant: 'destructive', title: 'Pick a blueprint', description: 'Seed defaults on the Blueprints tab if the list is empty.' });
      return;
    }
    setSaving(true);
    try {
      await createTenantWorkspace({ slug, displayName: name, blueprint: selectedBlueprint, modules });
      toast({ title: 'Tenant created', description: `Workspace "${name}" (${slug}) is live. Provision its admin with: node scripts/manage-auth-users.mjs create <email> <pass> admin --tenant ${slug}` });
      setIsFormOpen(false); setName(''); setTenantSlug('');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Could not create tenant', description: 'Check your super-admin permissions and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetStatus = async (t: Tenant, status: 'active' | 'suspended') => {
    try {
      await setTenantStatus(t, status);
      toast({ title: status === 'suspended' ? 'Tenant suspended' : 'Tenant reactivated', description: t.name });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    }
  };

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, suspend, and manage every client workspace.</p>
        </div>
        <Button size="sm" onClick={() => setIsFormOpen(v => !v)}>{isFormOpen ? 'Cancel' : 'New Tenant'}</Button>
      </div>

      <div className="flex gap-2">
        <Badge variant="default">{activeCount} active</Badge>
        <Badge variant={suspendedCount > 0 ? 'destructive' : 'secondary'}>{suspendedCount} suspended</Badge>
      </div>

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create tenant workspace</CardTitle>
            <CardDescription>Pick an industry template to pre-select modules, then adjust the allowance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">Company name</Label>
                <Input id="t-name" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Trading LLC" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-slug">Tenant ID (slug)</Label>
                <Input id="t-slug" value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} placeholder="acme-trading" />
              </div>
              <div className="space-y-2">
                <Label>Blueprint (vertical)</Label>
                <Select value={blueprintId} onValueChange={applyBlueprint}>
                  <SelectTrigger><SelectValue placeholder={activeBlueprints.length ? 'Select a vertical' : 'Seed defaults first'} /></SelectTrigger>
                  <SelectContent>
                    {activeBlueprints.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allowed modules</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {ALL_MODULES.map(m => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={modules.includes(m)}
                      onCheckedChange={(c) => setModules(prev => c ? [...new Set([...prev, m])] : prev.filter(x => x !== m))}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create tenant'}</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Tenants</CardTitle>
              <CardDescription>All client workspaces on this deployment.</CardDescription>
            </div>
            <ColumnVisibilityMenu visibility={columnVisibility} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead>{isVisible('id') && <TableHead>ID</TableHead>}{isVisible('blueprint') && <TableHead>Blueprint</TableHead>}{isVisible('modules') && <TableHead>Modules</TableHead>}{isVisible('status') && <TableHead>Status</TableHead>}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No tenants yet — create the first workspace above.</TableCell></TableRow>
              ) : tenants.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  {isVisible('id') && <TableCell className="font-mono text-xs">{t.id}</TableCell>}
                  {isVisible('blueprint') && <TableCell className="capitalize">{t.blueprintId ?? t.industry ?? '—'}</TableCell>}
                  {isVisible('modules') && <TableCell className="text-xs text-muted-foreground">{t.enabledModules?.length ?? 0} / {t.allowedModules?.length ?? 0} enabled</TableCell>}
                  {isVisible('status') && <TableCell><Badge variant={t.status === 'active' ? 'default' : 'destructive'}>{t.status}</Badge></TableCell>}
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTenant(t); setDetailOpen(true); }}>View</Button>
                    {t.status === 'active'
                      ? <Button size="sm" variant="outline" onClick={() => handleSetStatus(t, 'suspended')}>Suspend</Button>
                      : <Button size="sm" onClick={() => handleSetStatus(t, 'active')}>Reactivate</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TenantDetailSheet tenant={selectedTenant} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
