import { describe, expect, it } from 'vitest';
import { formatCustomFieldDisplayValue } from '@/components/custom-fields/custom-field-display';
import type { CustomFieldDefinition } from '@/types';

describe('formatCustomFieldDisplayValue', () => {
  it('appends the unit suffix when configured', () => {
    const field: CustomFieldDefinition = {
      id: 'cf-1',
      entity: 'invoice',
      key: 'odometer',
      label: 'Odometer',
      fieldType: 'number',
      unit: 'KM',
    };

    expect(formatCustomFieldDisplayValue(20000, field)).toBe('20,000 KM');
  });

  it('formats numeric strings with comma separators', () => {
    const field: CustomFieldDefinition = {
      id: 'cf-2',
      entity: 'invoice',
      key: 'odometer',
      label: 'Odometer',
      fieldType: 'number',
      unit: 'KM',
    };

    expect(formatCustomFieldDisplayValue('20000', field)).toBe('20,000 KM');
  });

  it('hides the unit suffix when explicitly disabled', () => {
    const field: CustomFieldDefinition = {
      id: 'cf-3',
      entity: 'invoice',
      key: 'odometer',
      label: 'Odometer',
      fieldType: 'number',
      unit: 'KM',
      showUnit: false,
    };

    expect(formatCustomFieldDisplayValue(20000, field)).toBe('20,000');
  });
});
