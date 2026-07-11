'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlatformData } from '@/hooks/use-platform-data';
import { usePlatformUsers } from '@/hooks/use-platform-users';
import type { Role } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const ROLES: Role[] = ['admin', 'manager', 'cashier', 'inventory-staff'];

const PLATFORM_USERS_COLUMNS: ColumnDef[] = [
    { id: 'user', label: 'User', locked: true },
    { id: 'email', label: 'Email' },
    { id: 'role', label: 'Role' },
    { id: 'tenant', label: 'Tenant' },
];

export default function SuperAdminUsersPage() {
  const { tenants } = usePlatformData();
  const { users, isLoaded } = usePlatformUsers(tenants);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const columnVisibility = useColumnVisibility('platform-users', PLATFORM_USERS_COLUMNS);
  const { isVisible } = columnVisibility;

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach(u => counts.set(u.role, (counts.get(u.role) ?? 0) + 1));
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      (roleFilter === 'all' || u.role === roleFilter) &&
      (tenantFilter === 'all' || u.tenantId === tenantFilter) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, search, roleFilter, tenantFilter]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map(r => (
          <Card key={r}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{r.replace('-', ' ')}s</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{isLoaded ? roleCounts.get(r) ?? 0 : '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User directory</CardTitle>
          <CardDescription>
            Every user profile across all tenants. Sign-in access comes from custom claims — change roles from a
            tenant&apos;s detail view, or with scripts/manage-auth-users.mjs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="sm:w-52"><SelectValue placeholder="Tenant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <ColumnVisibilityMenu visibility={columnVisibility} />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                {isVisible('email') && <TableHead>Email</TableHead>}
                {isVisible('role') && <TableHead>Role</TableHead>}
                {isVisible('tenant') && <TableHead>Tenant</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoaded ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users match.</TableCell></TableRow>
              ) : filtered.map(u => (
                <TableRow key={`${u.tenantId}:${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.avatar} alt={u.name} />
                        <AvatarFallback className="text-xs">{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  {isVisible('email') && <TableCell className="text-xs">{u.email}</TableCell>}
                  {isVisible('role') && <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>}
                  {isVisible('tenant') && <TableCell className="text-xs text-muted-foreground">{u.tenantName}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
