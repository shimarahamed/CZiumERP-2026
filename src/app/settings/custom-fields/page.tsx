'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { PlusCircle, Trash2, Pencil, ChevronUp, ChevronDown } from '@/components/icons';
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldType } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const CUSTOM_FIELDS_COLUMNS: ColumnDef[] = [
  { id: 'label', label: 'Label', locked: true },
  { id: 'key', label: 'Key' },
  { id: 'type', label: 'Type' },
  { id: 'required', label: 'Required' },
  { id: 'linked', label: 'Linked' },
  { id: 'source', label: 'Source' },
];

const ENTITIES: { id: CustomFieldEntity; label: string }[] = [
  { id: 'customer', label: 'Customers' },
  { id: 'product', label: 'Products' },
  { id: 'invoice', label: 'Invoices' },
];
const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'date', 'select', 'boolean'];

function slugKey(label: string): string {
  const parts = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  return parts.map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function CustomFieldsPageInner() {
  const { customFieldDefinitions, setCustomFieldDefinitions, addActivityLog } = useAppContext();
  const { toast } = useToast();

  const [entity, setEntity] = useState<CustomFieldEntity>('customer');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [linkSourceKey, setLinkSourceKey] = useState<string>('__none__');
  const [linkOffset, setLinkOffset] = useState('');

  // Edit dialog — reuses the same field-config shape as "Add", prefilled from
  // the definition being edited. Key/id/seededBy/createdAt are never changed;
  // existing records keep working with a relabeled/retyped field.
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editFieldType, setEditFieldType] = useState<CustomFieldType>('text');
  const [editRequired, setEditRequired] = useState(false);
  const [editOptionsText, setEditOptionsText] = useState('');
  const [editLinkSourceKey, setEditLinkSourceKey] = useState<string>('__none__');
  const [editLinkOffset, setEditLinkOffset] = useState('');

  const columnVisibility = useColumnVisibility('custom-fields', CUSTOM_FIELDS_COLUMNS);
  const { isVisible } = columnVisibility;

  const forEntity = customFieldDefinitions
    .filter(d => d.entity === entity)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));

  // Only other number fields on the same entity can be a link source.
  const numberFieldsForEntity = forEntity.filter(f => f.fieldType === 'number');

  const addField = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Label required' });
      return;
    }
    const key = slugKey(trimmed);
    if (customFieldDefinitions.some(d => d.entity === entity && d.key === key)) {
      toast({ variant: 'destructive', title: 'Duplicate field', description: `“${trimmed}” already exists on ${entity}.` });
      return;
    }
    const options = fieldType === 'select'
      ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;
    if (fieldType === 'select' && (!options || options.length === 0)) {
      toast({ variant: 'destructive', title: 'Select needs options', description: 'Add comma-separated choices.' });
      return;
    }
    const linked = fieldType === 'number' && linkSourceKey !== '__none__'
      ? { sourceKey: linkSourceKey, offset: Number(linkOffset) || 0 }
      : undefined;
    const def: CustomFieldDefinition = {
      id: `cf-${entity}-${key}-${Date.now()}`,
      entity, key, label: trimmed, fieldType, required,
      ...(options ? { options } : {}),
      ...(linked ? { linkedFrom: linked } : {}),
      order: forEntity.length + 1,
      createdAt: new Date().toISOString(),
    };
    setCustomFieldDefinitions(prev => [...prev, def]);
    addActivityLog('Custom Field Added', `${entity}: ${trimmed} (${fieldType})`);
    toast({ title: 'Field added', description: `${trimmed} on ${entity}` });
    setLabel(''); setRequired(false); setOptionsText(''); setFieldType('text');
    setLinkSourceKey('__none__'); setLinkOffset('');
  };

  const moveField = (def: CustomFieldDefinition, direction: 'up' | 'down') => {
    const index = forEntity.findIndex(d => d.id === def.id);
    const swapWith = direction === 'up' ? forEntity[index - 1] : forEntity[index + 1];
    if (!swapWith) return;
    const defOrder = def.order ?? index + 1;
    const swapOrder = swapWith.order ?? index + (direction === 'up' ? 0 : 2);
    setCustomFieldDefinitions(prev => prev.map(d => {
      if (d.id === def.id) return { ...d, order: swapOrder };
      if (d.id === swapWith.id) return { ...d, order: defOrder };
      return d;
    }));
  };

  const removeField = (def: CustomFieldDefinition) => {
    setCustomFieldDefinitions(prev => prev
      .filter(d => d.id !== def.id)
      // Fields that linked to the removed field become independent again.
      .map(d => d.entity === def.entity && d.linkedFrom?.sourceKey === def.key
        ? { ...d, linkedFrom: undefined }
        : d));
    addActivityLog('Custom Field Removed', `${def.entity}: ${def.label}`);
    toast({ title: 'Field removed', description: def.label });
  };

  const openEditField = (def: CustomFieldDefinition) => {
    setEditingField(def);
    setEditLabel(def.label);
    setEditFieldType(def.fieldType);
    setEditRequired(!!def.required);
    setEditOptionsText((def.options ?? []).join(', '));
    setEditLinkSourceKey(def.linkedFrom?.sourceKey ?? '__none__');
    setEditLinkOffset(def.linkedFrom ? String(def.linkedFrom.offset) : '');
  };

  const editNumberFieldsForEntity = editingField
    ? customFieldDefinitions.filter(f => f.entity === editingField.entity && f.fieldType === 'number' && f.id !== editingField.id)
    : [];

  const saveEditField = () => {
    if (!editingField) return;
    const trimmed = editLabel.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Label required' });
      return;
    }
    const options = editFieldType === 'select'
      ? editOptionsText.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;
    if (editFieldType === 'select' && (!options || options.length === 0)) {
      toast({ variant: 'destructive', title: 'Select needs options', description: 'Add comma-separated choices.' });
      return;
    }
    const linked = editFieldType === 'number' && editLinkSourceKey !== '__none__'
      ? { sourceKey: editLinkSourceKey, offset: Number(editLinkOffset) || 0 }
      : undefined;
    setCustomFieldDefinitions(prev => prev.map(d => d.id === editingField.id
      ? { ...d, label: trimmed, fieldType: editFieldType, required: editRequired, options, linkedFrom: linked }
      : d));
    addActivityLog('Custom Field Updated', `${editingField.entity}: ${trimmed}`);
    toast({ title: 'Field updated', description: trimmed });
    setEditingField(null);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Custom Fields" />
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Custom Fields' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a field</CardTitle>
            <CardDescription>
              Extra fields appear on the create/edit form for the chosen record type. Existing records simply leave them blank.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Applies to</Label>
                <Select value={entity} onValueChange={v => setEntity(v as CustomFieldEntity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTITIES.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Odometer (km)" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={fieldType} onValueChange={v => setFieldType(v as CustomFieldType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Required</Label>
                <div className="flex items-center gap-2 h-9">
                  <Checkbox checked={required} onCheckedChange={c => setRequired(c === true)} />
                  <span className="text-sm text-muted-foreground">Must be filled</span>
                </div>
              </div>
            </div>
            {fieldType === 'select' && (
              <div className="space-y-1.5">
                <Label>Options (comma-separated)</Label>
                <Input value={optionsText} onChange={e => setOptionsText(e.target.value)} placeholder="Small, Medium, Large" />
              </div>
            )}
            {fieldType === 'number' && numberFieldsForEntity.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                <div className="space-y-1.5">
                  <Label>Auto-fill from (optional)</Label>
                  <Select value={linkSourceKey} onValueChange={setLinkSourceKey}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None — independent field</SelectItem>
                      {numberFieldsForEntity.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {linkSourceKey !== '__none__' && (
                  <div className="space-y-1.5">
                    <Label>Default offset</Label>
                    <Input
                      type="number"
                      value={linkOffset}
                      onChange={e => setLinkOffset(e.target.value)}
                      placeholder="e.g. 5000"
                    />
                  </div>
                )}
                {linkSourceKey !== '__none__' && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    When {numberFieldsForEntity.find(f => f.key === linkSourceKey)?.label} is entered, this field auto-fills to that value + offset. Staff can still edit the result and the offset per record.
                  </p>
                )}
              </div>
            )}
            <Button onClick={addField}><PlusCircle className="w-4 h-4 mr-1" />Add field</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base">Fields on {ENTITIES.find(e => e.id === entity)?.label}</CardTitle>
                <CardDescription>Fields seeded from your business type show a badge. Remove any you don’t need.</CardDescription>
              </div>
              <ColumnVisibilityMenu visibility={columnVisibility} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {forEntity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No custom fields for this record type yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Label</TableHead>
                  {isVisible('key') && <TableHead>Key</TableHead>}
                  {isVisible('type') && <TableHead>Type</TableHead>}
                  {isVisible('required') && <TableHead>Required</TableHead>}
                  {isVisible('linked') && <TableHead>Linked</TableHead>}
                  {isVisible('source') && <TableHead>Source</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {forEntity.map((f, i) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          <div className="flex flex-col -my-1">
                            <Button
                              size="icon" variant="ghost" className="h-5 w-5"
                              onClick={() => moveField(f, 'up')} disabled={i === 0}
                            ><ChevronUp className="w-3.5 h-3.5" /></Button>
                            <Button
                              size="icon" variant="ghost" className="h-5 w-5"
                              onClick={() => moveField(f, 'down')} disabled={i === forEntity.length - 1}
                            ><ChevronDown className="w-3.5 h-3.5" /></Button>
                          </div>
                          <span>{f.label}</span>
                        </div>
                      </TableCell>
                      {isVisible('key') && <TableCell className="font-mono text-xs">{f.key}</TableCell>}
                      {isVisible('type') && <TableCell className="capitalize">{f.fieldType}{f.options ? ` (${f.options.length})` : ''}</TableCell>}
                      {isVisible('required') && <TableCell>{f.required ? 'Yes' : 'No'}</TableCell>}
                      {isVisible('linked') && (
                        <TableCell>
                          {f.linkedFrom ? (
                            <Badge variant="outline">
                              {forEntity.find(o => o.key === f.linkedFrom!.sourceKey)?.label ?? f.linkedFrom.sourceKey} + {f.linkedFrom.offset}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      )}
                      {isVisible('source') && <TableCell>{f.seededBy ? <Badge variant="secondary">{f.seededBy}</Badge> : <Badge variant="outline">custom</Badge>}</TableCell>}
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditField(f)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeField(f)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit field</DialogTitle>
            <DialogDescription>
              Key <span className="font-mono">{editingField?.key}</span> stays the same — existing records keep their data.
            </DialogDescription>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="e.g. Odometer (km)" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editFieldType} onValueChange={v => setEditFieldType(v as CustomFieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={editRequired} onCheckedChange={c => setEditRequired(c === true)} />
                <span className="text-sm text-muted-foreground">Must be filled</span>
              </div>
              {editFieldType === 'select' && (
                <div className="space-y-1.5">
                  <Label>Options (comma-separated)</Label>
                  <Input value={editOptionsText} onChange={e => setEditOptionsText(e.target.value)} placeholder="Small, Medium, Large" />
                </div>
              )}
              {editFieldType === 'number' && editNumberFieldsForEntity.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label>Auto-fill from (optional)</Label>
                    <Select value={editLinkSourceKey} onValueChange={setEditLinkSourceKey}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None — independent field</SelectItem>
                        {editNumberFieldsForEntity.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {editLinkSourceKey !== '__none__' && (
                    <div className="space-y-1.5">
                      <Label>Default offset</Label>
                      <Input type="number" value={editLinkOffset} onChange={e => setEditLinkOffset(e.target.value)} placeholder="e.g. 5000" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button onClick={saveEditField}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomFieldsPage() {
  const isAllowed = useRequireRole(['admin']);
  if (!isAllowed) return null;
  return <CustomFieldsPageInner />;
}
