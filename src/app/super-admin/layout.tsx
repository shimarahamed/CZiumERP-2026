'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import {
  Shield,
  LogOut,
  LayoutDashboard,
  Building2,
  Sparkles,
  Users,
  PlugZap,
  Inbox,
  Settings,
  Search,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { CommandPalette } from '@/components/super-admin/CommandPalette';

const NAV = [
  { href: '/super-admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/super-admin/blueprints', label: 'Blueprints', icon: Sparkles },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/modules', label: 'Modules', icon: PlugZap },
  { href: '/super-admin/requests', label: 'Requests', icon: Inbox },
  { href: '/super-admin/system', label: 'System', icon: Settings },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isHydrated, user, logout } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isHydrated) return null;

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Super Admin access required</CardTitle>
            <CardDescription>
              This console is restricted to platform operators. Sign in with a super-admin account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="p-1.5 bg-primary/15 rounded-md shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">Platform Console</h1>
              <p className="text-xs text-muted-foreground leading-tight truncate">CZium ERP — Super Admin</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="mx-2 justify-start gap-2 text-muted-foreground font-normal group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Search…</span>
            <span className="ml-auto text-xs border rounded px-1 py-0.5 group-data-[collapsible=icon]:hidden">Ctrl K</span>
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2">
            {NAV.map(item => {
              const active = pathname === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              'mx-2 justify-start gap-2 text-muted-foreground',
              'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
}
