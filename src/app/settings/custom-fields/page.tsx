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
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { PlusCircle, Trash2 } from '@/components/icons';
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldType } from '@/types';

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

  const forEntity = customFieldDefinitions
    .filter(d => d.entity === entity)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));

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
    const def: CustomFieldDefinition = {
      id: `cf-${entity}-${key}-${Date.now()}`,
      entity, key, label: trimmed, fieldType, required,
      ...(options ? { options } : {}),
      order: forEntity.length + 1,
      createdAt: new Date().toISOString(),
    };
    setCustomFieldDefinitions(prev => [...prev, def]);
    addActivityLog('Custom Field Added', `${entity}: ${trimmed} (${fieldType})`);
    toast({ title: 'Field added', description: `${trimmed} on ${entity}` });
    setLabel(''); setRequired(false); setOptionsText(''); setFieldType('text');
  };

  const removeField = (def: CustomFieldDefinition) => {
    setCustomFieldDefinitions(prev => prev.filter(d => d.id !== def.id));
    addActivityLog('Custom Field Removed', `${def.entity}: ${def.label}`);
    toast({ title: 'Field removed', description: def.label });
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
            <Button onClick={addField}><PlusCircle className="w-4 h-4 mr-1" />Add field</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fields on {ENTITIES.find(e => e.id === entity)?.label}</CardTitle>
            <CardDescription>Fields seeded from your business type show a badge. Remove any you don’t need.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {forEntity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No custom fields for this record type yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Key</TableHead><TableHead>Type</TableHead><TableHead>Required</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {forEntity.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.label}</TableCell>
                      <TableCell className="font-mono text-xs">{f.key}</TableCell>
                      <TableCell className="capitalize">{f.fieldType}{f.options ? ` (${f.options.length})` : ''}</TableCell>
                      <TableCell>{f.required ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{f.seededBy ? <Badge variant="secondary">{f.seededBy}</Badge> : <Badge variant="outline">custom</Badge>}</TableCell>
                      <TableCell className="text-right">
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
    </div>
  );
}

export default function CustomFieldsPage() {
  const isAllowed = useRequireRole(['admin']);
  if (!isAllowed) return null;
  return <CustomFieldsPageInner />;
}
