import type { Role, Module, PermissionAction, ModulePermission, CustomRole, User } from '@/types';

const DEFAULT_PERMISSIONS: Record<Role, ModulePermission[]> = {
  admin: [
    { module: 'General', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Sales & Customers', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Supply Chain', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Manufacturing', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Shipping & Logistics', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Finance', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Human Resources', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Project Management', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'Service Desk', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'System', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
  ],
  manager: [
    { module: 'General', actions: ['view', 'create', 'edit'] },
    { module: 'Sales & Customers', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'Supply Chain', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'Manufacturing', actions: ['view', 'create', 'edit'] },
    { module: 'Shipping & Logistics', actions: ['view', 'create', 'edit'] },
    { module: 'Finance', actions: ['view', 'create', 'edit'] },
    { module: 'Human Resources', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'Project Management', actions: ['view', 'create', 'edit'] },
    { module: 'Service Desk', actions: ['view', 'create', 'edit'] },
    { module: 'System', actions: ['view'] },
  ],
  cashier: [
    { module: 'General', actions: ['view'] },
    // 'edit' is what the POS page (register) requires — a cashier ringing up a
    // sale updates invoices, customers, and stock, so they need it here.
    { module: 'Sales & Customers', actions: ['view', 'create', 'edit'] },
    { module: 'Supply Chain', actions: ['view'] },
    { module: 'Finance', actions: ['view'] },
  ],
  'inventory-staff': [
    { module: 'General', actions: ['view'] },
    { module: 'Supply Chain', actions: ['view', 'create', 'edit'] },
    { module: 'Manufacturing', actions: ['view', 'create', 'edit'] },
  ],
};

export function can(
  role: Role,
  module: Module,
  action: PermissionAction,
  customPermissions?: ModulePermission[]
): boolean {
  const permissions = customPermissions ?? DEFAULT_PERMISSIONS[role] ?? [];
  const modulePerm = permissions.find(p => p.module === module);
  return !!modulePerm?.actions.includes(action);
}

export function getDefaultPermissions(role: Role): ModulePermission[] {
  return DEFAULT_PERMISSIONS[role] ?? [];
}

/**
 * Resolves the permission set that actually governs a user: their assigned custom role's
 * grants when `user.customRoleId` points to one, otherwise their base role's defaults.
 * A user with no custom role behaves identically to today (DEFAULT_PERMISSIONS[role]).
 */
export function getEffectivePermissions(user: Pick<User, 'role' | 'customRoleId'>, roles: CustomRole[]): ModulePermission[] {
  if (user.customRoleId) {
    const customRole = roles.find(r => r.id === user.customRoleId);
    if (customRole) return customRole.permissions;
  }
  return getDefaultPermissions(user.role);
}
