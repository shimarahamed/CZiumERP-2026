'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { usePlatformData } from '@/hooks/use-platform-data';
import { usePlatformUsers } from '@/hooks/use-platform-users';
import { TenantDetailSheet } from '@/components/super-admin/TenantDetailSheet';
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Users,
  PlugZap,
  Inbox,
  Settings,
} from '@/components/icons';
import type { Tenant } from '@/types';

const NAV_ITEMS = [
  { href: '/super-admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/super-admin/blueprints', label: 'Blueprints', icon: Sparkles },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/modules', label: 'Modules', icon: PlugZap },
  { href: '/super-admin/requests', label: 'Requests', icon: Inbox },
  { href: '/super-admin/system', label: 'System', icon: Settings },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { tenants } = usePlatformData();
  const { users } = usePlatformUsers(tenants);
  const [search, setSearch] = useState('');
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const matchingTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants.slice(0, 5);
    return tenants.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)).slice(0, 8);
  }, [tenants, search]);

  const matchingUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 8);
  }, [users, search]);

  const runNav = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const openTenant = (t: Tenant) => {
    onOpenChange(false);
    setDetailTenant(t);
    setDetailOpen(true);
  };

  const openUser = (tenantId: string) => {
    onOpenChange(false);
    router.push(`/super-admin/users?search=${encodeURIComponent(search)}`);
    void tenantId;
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput
          placeholder="Jump to a section, tenant, or user…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {NAV_ITEMS.map(item => (
              <CommandItem key={item.href} value={`nav-${item.label}`} onSelect={() => runNav(item.href)}>
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {matchingTenants.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tenants">
                {matchingTenants.map(t => (
                  <CommandItem key={t.id} value={`tenant-${t.name}-${t.id}`} onSelect={() => openTenant(t)}>
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{t.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{t.id}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {matchingUsers.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Users">
                {matchingUsers.map(u => (
                  <CommandItem key={`${u.tenantId}:${u.id}`} value={`user-${u.name}-${u.email}`} onSelect={() => openUser(u.tenantId)}>
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{u.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
      <TenantDetailSheet tenant={detailTenant} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
