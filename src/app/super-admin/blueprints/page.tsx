'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePlatformData } from '@/hooks/use-platform-data';
import { ALL_MODULES, seedBlueprints, saveBlueprint, deleteBlueprint, slugify } from '@/lib/super-admin';
import { PlusCircle, Trash2 } from '@/components/icons';
import type { VerticalBlueprint, Module, CustomFieldSeed, CustomFieldEntity, CustomFieldType } from '@/types';

const ENTITIES: CustomFieldEntity[] = ['customer', 'product', 'invoice'];
const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'date', 'select', 'boolean'];

const emptyBlueprint = (): VerticalBlueprint => ({
  id: '', name: '', description: '', modules: [...ALL_MODULES],
  labelOverrides: {}, seedFields: [], isActive: true,
});

export default function SuperAdminBlueprintsPage() {
  const { toast } = useToast();
  const { blueprints, tenants } = usePlatformData();
  const [draft, setDraft] = useState<VerticalBlueprint | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const tenantCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tenants.forEach(t => { if (t.blueprintId) counts[t.blueprintId] = (counts[t.blueprintId] ?? 0) + 1; });
    return counts;
  }, [tenants]);

  const startEdit = (bp: VerticalBlueprint) => {
    setDraft(JSON.parse(JSON.stringify(bp)));
    setIsNew(false);
  };
  const startNew = () => { setDraft(emptyBlueprint()); setIsNew(true); };

  const handleSeed = async () => {
    setBusy(true);
    try {
      await seedBlueprints();
      toast({ title: 'Default blueprints seeded' });
    } catch { toast({ variant: 'destructive', title: 'Seed failed' }); }
    finally { setBusy(false); }
  };

  const handleSave = async () => {
    if (!draft) return;
    const id = isNew ? slugify(draft.id || draft.name) : draft.id;
    if (!id || !draft.name.trim()) {
      toast({ variant: 'destructive', title: 'ID and name are required' });
      return;
    }
    // Strip incomplete seed-field rows before saving.
    const seedFields = (draft.seedFields ?? []).filter(f => f.key.trim() && f.label.trim());
    setBusy(true);
    try {
      await saveBlueprint({ ...draft, id, seedFields });
      toast({ title: isNew ? 'Blueprint created' : 'Blueprint saved', description: draft.name });
      setDraft(null);
    } catch { toast({ variant: 'destructive', title: 'Save failed' }); }
    finally { setBusy(false); }
  };

  const handleDelete = async (bp: VerticalBlueprint) => {
    if (tenantCounts[bp.id]) {
      toast({ variant: 'destructive', title: 'In use', description: `${tenantCounts[bp.id]} tenant(s) use this blueprint.` });
      return;
    }
    setBusy(true);
    try {
      await deleteBlueprint(bp.id);
      toast({ title: 'Blueprint deleted', description: bp.name });
    } catch { toast({ variant: 'destructive', title: 'Delete failed' }); }
    finally { setBusy(false); }
  };

  // ---- draft mutators ----
  const setField = (patch: Partial<VerticalBlueprint>) => setDraft(d => d ? { ...d, ...patch } : d);
  const toggleModule = (m: Module, on: boolean) =>
    setField({ modules: on ? [...new Set([...(draft?.modules ?? []), m])] : (draft?.modules ?? []).filter(x => x !== m) });
  const labelRows = Object.entries(draft?.labelOverrides ?? {});
  const setLabelRow = (i: number, from: string, to: string) => {
    const entries = [...labelRows];
    entries[i] = [from, to];
    setField({ labelOverrides: Object.fromEntries(entries.filter(([k]) => k.trim())) });
  };
  const addLabelRow = () => setField({ labelOverrides: { ...(draft?.labelOverrides ?? {}), '': '' } });
  const removeLabelRow = (from: string) => {
    const next = { ...(draft?.labelOverrides ?? {}) };
    delete next[from];
    setField({ labelOverrides: next });
  };
  const setSeed = (i: number, patch: Partial<CustomFieldSeed>) => {
    const next = [...(draft?.seedFields ?? [])];
    next[i] = { ...next[i], ...patch };
    setField({ seedFields: next });
  };
  const addSeed = () => setField({ seedFields: [...(draft?.seedFields ?? []), { entity: 'customer', key: '', label: '', fieldType: 'text', order: (draft?.seedFields?.length ?? 0) + 1 }] });
  const removeSeed = (i: number) => setField({ seedFields: (draft?.seedFields ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Verticals define the module bundle, custom fields, and label overrides a tenant starts with. Editable here — no deploy needed.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSeed} disabled={busy}>Seed defaults</Button>
          <Button size="sm" onClick={startNew}><PlusCircle className="w-4 h-4 mr-1" />New blueprint</Button>
        </div>
      </div>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isNew ? 'New blueprint' : `Edit — ${draft.name}`}</CardTitle>
            <CardDescription>Anything set here is copied into a tenant at onboarding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={draft.name} onChange={e => setField({ name: e.target.value })} placeholder="Auto Garage" />
              </div>
              <div className="space-y-2">
                <Label>ID (slug)</Label>
                <Input value={draft.id} disabled={!isNew} onChange={e => setField({ id: e.target.value })} placeholder="garage" />
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center gap-2 h-9">
                  <Checkbox checked={draft.isActive !== false} onCheckedChange={c => setField({ isActive: c === true })} />
                  <span className="text-sm text-muted-foreground">Selectable at sign-up</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description ?? ''} onChange={e => setField({ description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Modules</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {ALL_MODULES.map(m => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={draft.modules.includes(m)} onCheckedChange={c => toggleModule(m, c === true)} />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Label overrides</Label>
                <Button size="sm" variant="ghost" onClick={addLabelRow}><PlusCircle className="w-4 h-4 mr-1" />Add</Button>
              </div>
              <p className="text-xs text-muted-foreground">Rename an entity in the tenant UI, e.g. Product → Part.</p>
              {labelRows.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : labelRows.map(([from, to], i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="flex-1" value={from} onChange={e => setLabelRow(i, e.target.value, to)} placeholder="Product" />
                  <span className="text-muted-foreground">→</span>
                  <Input className="flex-1" value={to} onChange={e => setLabelRow(i, from, e.target.value)} placeholder="Part" />
                  <Button size="icon" variant="ghost" onClick={() => removeLabelRow(from)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Seed custom fields</Label>
                <Button size="sm" variant="ghost" onClick={addSeed}><PlusCircle className="w-4 h-4 mr-1" />Add</Button>
              </div>
              <p className="text-xs text-muted-foreground">Fields every tenant on this vertical starts with. Tenant admins can add more later.</p>
              {(draft.seedFields ?? []).length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : (draft.seedFields ?? []).map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                  <Select value={f.entity} onValueChange={v => setSeed(i, { entity: v as CustomFieldEntity })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENTITIES.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={f.label} onChange={e => setSeed(i, { label: e.target.value, key: f.key || slugify(e.target.value).replace(/-/g, '') })} placeholder="Label" />
                  <Input value={f.key} onChange={e => setSeed(i, { key: e.target.value })} placeholder="key" className="font-mono text-xs" />
                  <Select value={f.fieldType} onValueChange={v => setSeed(i, { fieldType: v as CustomFieldType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => removeSeed(i)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save blueprint'}</Button>
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blueprints</CardTitle>
          <CardDescription>The vertical catalog offered at onboarding.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Modules</TableHead><TableHead>Seed fields</TableHead><TableHead>Tenants</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {blueprints.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No blueprints yet — click “Seed defaults”.</TableCell></TableRow>
              ) : blueprints.map(bp => (
                <TableRow key={bp.id}>
                  <TableCell className="font-medium">{bp.name}{bp.isActive === false && <Badge variant="secondary" className="ml-2">inactive</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{bp.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bp.modules.length}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bp.seedFields?.length ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{tenantCounts[bp.id] ?? 0}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(bp)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(bp)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
