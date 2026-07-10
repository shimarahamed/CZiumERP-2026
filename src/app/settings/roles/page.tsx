'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { Trash2 } from 'lucide-react';
import type { Module, ModulePermission, PermissionAction, Role, CustomRole } from '@/types';

// Must match the real Module union in src/types/index.ts exactly — a mismatched entry
// here would silently never match anything in can()'s lookup.
const MODULES: Module[] = ['General', 'Sales & Customers', 'Supply Chain', 'Shipping & Logistics', 'Manufacturing', 'Finance', 'Human Resources', 'Project Management', 'Service Desk', 'System'];
const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve'];
const BASE_ROLES: Role[] = ['manager', 'cashier', 'inventory-staff'];

function RoleBuilderInner() {
  const { addActivityLog, roles, setRoles, users, setUsers, user: currentUser } = useAppContext();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [baseRole, setBaseRole] = useState<Role>('cashier');
  const [perms, setPerms] = useState<ModulePermission[]>([]);

  const toggle = (module: Module, action: PermissionAction, on: boolean) => {
    setPerms(prev => {
      const existing = prev.find(p => p.module === module);
      if (!existing) return on ? [...prev, { module, actions: [action] }] : prev;
      const actions = on
        ? [...new Set([...existing.actions, action])]
        : existing.actions.filter(a => a !== action);
      const rest = prev.filter(p => p.module !== module);
      return actions.length ? [...rest, { module, actions }] : rest;
    });
  };

  const saveRole = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Role name is required' }); return; }
    if (perms.length === 0) { toast({ variant: 'destructive', title: 'Grant at least one permission' }); return; }
    const id = `role-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const newRole: CustomRole = { id, name: trimmed, baseRole, permissions: perms };
    setRoles(prev => [...prev.filter(r => r.id !== id), newRole]);
    addActivityLog('Custom Role Saved', `Role "${trimmed}" (base: ${baseRole}) with ${perms.length} module grants.`);
    toast({ title: 'Role saved', description: `"${trimmed}" is available to assign to users below. Sign-in still uses the base role for auth; this refines what they can do in-app.` });
    setName(''); setBaseRole('cashier'); setPerms([]);
  };

  const removeRole = (r: CustomRole) => {
    setRoles(prev => prev.filter(x => x.id !== r.id));
    // Unassign this role from anyone using it — a dangling customRoleId would silently fail to resolve.
    setUsers(prev => prev.map(u => u.customRoleId === r.id ? { ...u, customRoleId: undefined } : u));
    addActivityLog('Custom Role Deleted', `Role "${r.name}" removed.`);
  };

  const assignRole = (userId: string, customRoleId: string) => {
    const target = users.find(u => u.id === userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, customRoleId: customRoleId === 'none' ? undefined : customRoleId } : u));
    addActivityLog('Custom Role Assigned', `${target?.name ?? userId} assigned role "${customRoleId === 'none' ? 'none (base role)' : roles.find(r => r.id === customRoleId)?.name}".`);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Custom Roles" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build a role</CardTitle>
            <CardDescription>Tick the exact module × action grants for this role. Custom roles refine permissions within your workspace — sign-in still authenticates against the base role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role name</Label>
                <Input id="role-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Store Supervisor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="base-role">Base role</Label>
                <Select value={baseRole} onValueChange={(v) => setBaseRole(v as Role)}>
                  <SelectTrigger id="base-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BASE_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    {ACTIONS.map(a => <TableHead key={a} className="text-center capitalize">{a}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULES.map(m => {
                    const row = perms.find(p => p.module === m);
                    return (
                      <TableRow key={m}>
                        <TableCell className="font-medium">{m}</TableCell>
                        {ACTIONS.map(a => (
                          <TableCell key={a} className="text-center">
                            <Checkbox
                              aria-label={`${m} ${a}`}
                              checked={row?.actions.includes(a) ?? false}
                              onCheckedChange={(c) => toggle(m, a, c === true)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button onClick={saveRole}>Save role</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Existing custom roles</CardTitle></CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No custom roles yet — build your first one above.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Base</TableHead><TableHead>Grants</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {roles.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm capitalize">{r.baseRole}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.permissions.map(p => `${p.module} (${p.actions.join(', ')})`).join(' · ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => removeRole(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign roles to users</CardTitle>
            <CardDescription>Give a user a custom role to refine what they can do beyond their base role&apos;s defaults. Choose &quot;None&quot; to fall back to base-role defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No users yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Base Role</TableHead><TableHead>Custom Role</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name} <span className="text-muted-foreground font-normal">({u.email})</span></TableCell>
                      <TableCell className="text-sm capitalize">{u.role}</TableCell>
                      <TableCell>
                        <Select value={u.customRoleId ?? 'none'} onValueChange={(v) => assignRole(u.id, v)} disabled={u.id === currentUser?.id}>
                          <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (base role defaults)</SelectItem>
                            {roles.filter(r => r.baseRole === u.role).map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

// Permission guard wrapper keeps hook order stable (React rules-of-hooks).
export default function RoleBuilderPage() {
  const isAllowed = useRequireRole(['admin']);
  if (!isAllowed) return null;
  return <RoleBuilderInner />;
}
