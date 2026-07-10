'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, LogOut } from '@/components/icons';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/super-admin', label: 'Overview' },
  { href: '/super-admin/tenants', label: 'Tenants' },
  { href: '/super-admin/blueprints', label: 'Blueprints' },
  { href: '/super-admin/users', label: 'Users' },
  { href: '/super-admin/modules', label: 'Modules' },
  { href: '/super-admin/requests', label: 'Requests' },
  { href: '/super-admin/system', label: 'System' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isHydrated, user, logout } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();

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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary/15 rounded-md">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Platform Console</h1>
              <p className="text-xs text-muted-foreground leading-tight">CZium ERP — Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 px-4 md:px-6">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
