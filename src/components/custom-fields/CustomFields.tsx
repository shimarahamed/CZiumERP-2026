'use client';

import { useAppContext } from '@/context/AppContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomFieldDefinition, CustomFieldEntity } from '@/types';
import { formatCustomFieldDisplayValue } from '@/components/custom-fields/custom-field-display';

/** Definitions for one entity, sorted for stable form ordering. */
export function useCustomFields(entity: CustomFieldEntity): CustomFieldDefinition[] {
  const { customFieldDefinitions } = useAppContext();
  return customFieldDefinitions
    .filter(d => d.entity === entity)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
}

type SectionProps = {
  entity: CustomFieldEntity;
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown>) => void;
};

/**
 * Renders the tenant's custom fields for an entity as form inputs, driven
 * entirely by CustomFieldDefinition docs. Drop into any create/edit form and
 * bind to the entity's `customData` bag. Renders nothing if the tenant has no
 * fields for this entity, so it's inert for tenants that never configured any.
 */
export function CustomFieldsFormSection({ entity, value, onChange }: SectionProps) {
  const fields = useCustomFields(entity);
  if (fields.length === 0) return null;

  const data = value ?? {};
  const set = (key: string, v: unknown) => onChange({ ...data, [key]: v });

  /**
   * Linked number fields auto-fill from `source + offset` whenever the
   * source value changes. The offset comes from the field definition and
   * the resulting value stays a normal editable field afterward.
   */
  const setSourceField = (f: CustomFieldDefinition, v: number | undefined) => {
    const next = { ...data, [f.key]: v };
    for (const dependent of fields) {
      if (dependent.linkedFrom?.sourceKey !== f.key) continue;
      next[dependent.key] = v === undefined ? undefined : v + dependent.linkedFrom.offset;
    }
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Additional details</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
        {fields.map(f => {
          const id = `cf-${entity}-${f.key}`;
          const raw = data[f.key];
          if (f.fieldType === 'boolean') {
            return (
              <label key={f.key} htmlFor={id} className="flex items-center gap-2 text-sm self-end h-9">
                <Checkbox id={id} checked={raw === true} onCheckedChange={c => set(f.key, c === true)} />
                {f.label}{f.required && <span className="text-destructive">*</span>}
              </label>
            );
          }
          const isLinkTarget = f.fieldType === 'number' && !!f.linkedFrom;
          return (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
              </Label>
              {f.fieldType === 'select' ? (
                <Select value={typeof raw === 'string' ? raw : ''} onValueChange={v => set(f.key, v)}>
                  <SelectTrigger id={id}><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{(f.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : isLinkTarget ? (
                <Input
                  id={id}
                  type="number"
                  value={raw === undefined || raw === null ? '' : String(raw)}
                  required={f.required}
                  onChange={e => set(f.key, e.target.value === '' ? undefined : Number(e.target.value))}
                />
              ) : f.fieldType === 'number' ? (
                <Input
                  id={id}
                  type="number"
                  value={raw === undefined || raw === null ? '' : String(raw)}
                  required={f.required}
                  onChange={e => setSourceField(f, e.target.value === '' ? undefined : Number(e.target.value))}
                />
              ) : (
                <Input
                  id={id}
                  type={f.fieldType === 'date' ? 'date' : 'text'}
                  value={raw === undefined || raw === null ? '' : String(raw)}
                  required={f.required}
                  onChange={e => set(f.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only key/value list of an entity's custom fields for detail views. */
export function CustomFieldsDisplay({ entity, value }: { entity: CustomFieldEntity; value: Record<string, unknown> | undefined }) {
  const fields = useCustomFields(entity);
  const data = value ?? {};
  const populated = fields.filter(f => data[f.key] !== undefined && data[f.key] !== '' && data[f.key] !== null);
  if (populated.length === 0) return null;

  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {populated.map(f => (
        <div key={f.key} className="contents">
          <dt className="text-muted-foreground whitespace-nowrap pr-3 text-left">{f.label}</dt>
          <dd className="font-medium break-words text-left">{formatCustomFieldDisplayValue(data[f.key], f)}</dd>
        </div>
      ))}
    </dl>
  );
}
