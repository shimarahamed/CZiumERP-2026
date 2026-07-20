import type { CustomFieldDefinition } from '@/types';

function formatNumericValue(value: number | string): string {
  if (typeof value === 'number') {
    return value.toLocaleString('en-US');
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue.toLocaleString('en-US');
  }

  return String(value);
}

export function formatCustomFieldDisplayValue(value: unknown, field: CustomFieldDefinition): string {
  if (value === undefined || value === null || value === '') return '';

  if (field.fieldType === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  const text = field.fieldType === 'number' && (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value)))
    ? formatNumericValue(typeof value === 'number' ? value : String(value))
    : String(value);

  const shouldShowUnit = field.showUnit !== false && !!field.unit?.trim();
  return shouldShowUnit ? `${text} ${field.unit!.trim()}` : text;
}
