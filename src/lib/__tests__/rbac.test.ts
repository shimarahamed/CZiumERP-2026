import { describe, it, expect } from 'vitest';
import { can, getDefaultPermissions } from '@/lib/rbac';

describe('RBAC permissions', () => {
  it('admin can approve in Finance', () => {
    expect(can('admin', 'Finance', 'approve')).toBe(true);
  });

  it('cashier cannot delete in Finance', () => {
    expect(can('cashier', 'Finance', 'delete')).toBe(false);
  });

  it('cashier can create in Sales & Customers', () => {
    expect(can('cashier', 'Sales & Customers', 'create')).toBe(true);
  });

  it('inventory-staff has no Finance access', () => {
    expect(can('inventory-staff', 'Finance', 'view')).toBe(false);
  });

  it('manager cannot delete in System module', () => {
    expect(can('manager', 'System', 'delete')).toBe(false);
  });

  it('custom permissions override defaults', () => {
    expect(
      can('cashier', 'Finance', 'delete', [
        { module: 'Finance', actions: ['view', 'delete'] },
      ])
    ).toBe(true);
  });

  it('every role resolves to a defined permission set', () => {
    for (const role of ['admin', 'manager', 'cashier', 'inventory-staff'] as const) {
      expect(getDefaultPermissions(role).length).toBeGreaterThan(0);
    }
  });
});
