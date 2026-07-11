
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
} from '@/components/ui/sidebar';
import Nav from '@/components/Nav';
import { Button } from '@/components/ui/button';
import { LifeBuoy, Store, Loader2 } from '@/components/icons';
import UserNav from './UserNav';
import Image from 'next/image';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';

const UNAUTH_ROUTES = ['/login', '/register'];
// Pages with no tenant sidebar shell (they render standalone or bring their
// own chrome — the super-admin platform console has its own layout).
const NO_SHELL_ROUTES = ['/login', '/register', '/select-store'];
const isPlatformConsoleRoute = (pathname: string) => pathname.startsWith('/super-admin');
// Pages that don't require a resolved store.
const NO_STORE_REQUIRED_ROUTES = NO_SHELL_ROUTES;
const SIDEBAR_KEY = 'czium-sidebar-open';

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Loading Application...</p>
    </div>
  );
}

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentStore, isHydrated, isStoreResolving, themeSettings, isSuperAdmin, user, companyName } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const isNavigating = useNavigationLoading(80);

  // Persist sidebar open/closed state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored === null ? true : stored === 'true';
  });

  const handleSidebarChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem(SIDEBAR_KEY, String(open));
  };

  useEffect(() => {
    if (isHydrated) {
      document.title = themeSettings.appName;
    }
  }, [isHydrated, themeSettings.appName]);

  useEffect(() => {
    if (!isHydrated) return;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // SW registration failure is non-fatal
        });
      });
    }

    if (!isAuthenticated && !UNAUTH_ROUTES.includes(pathname) && !NO_STORE_REQUIRED_ROUTES.includes(pathname)) {
      router.push('/login');
    } else if (isAuthenticated && isSuperAdmin && !isPlatformConsoleRoute(pathname)) {
      // Super admins are platform operators — tenant pages cannot work for
      // them (no tenantId claim), so the console is their whole world.
      router.push('/super-admin');
    } else if (isAuthenticated && pathname === '/login') {
      const home = isSuperAdmin ? '/super-admin' : (user?.role === 'cashier' ? '/pos' : '/');
      router.push(home);
    } else if (isAuthenticated && !isSuperAdmin && !currentStore && !isStoreResolving && !NO_STORE_REQUIRED_ROUTES.includes(pathname) && !isPlatformConsoleRoute(pathname)) {
      router.push('/select-store');
    } else if (isAuthenticated && currentStore && pathname === '/select-store') {
      router.push(user?.role === 'cashier' ? '/pos' : '/');
    }
  }, [isAuthenticated, currentStore, pathname, router, isHydrated, isSuperAdmin, isStoreResolving, user?.role]);

  if (!isHydrated) {
    return <FullScreenLoader />;
  }

  const isNoShellPage = NO_SHELL_ROUTES.includes(pathname) || isPlatformConsoleRoute(pathname);

  if (isNoShellPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <FullScreenLoader />;
  }

  return (
    <>
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
        <Sidebar collapsible="icon">
          <div className="flex flex-col h-full">
            <SidebarHeader className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg flex items-center justify-center h-10 w-10 shrink-0 overflow-hidden">
                {themeSettings.logoUrl ? (
                  <Image src={themeSettings.logoUrl} alt={companyName} width={24} height={24} className="object-contain rounded-md" />
                ) : (
                  <Store className="w-6 h-6 text-primary" />
                )}
              </div>
              <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden truncate">{companyName}</h1>
            </SidebarHeader>
            <SidebarContent>
              <Nav />
            </SidebarContent>
            <SidebarFooter className="p-4 space-y-2">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 group-data-[collapsible=icon]:justify-center">
                <LifeBuoy className="w-4 h-4" />
                <span className="group-data-[collapsible=icon]:hidden">Support</span>
              </Button>
              <div className="border-t border-sidebar-border/50 my-2"></div>
              <UserNav />
            </SidebarFooter>
          </div>
        </Sidebar>
        <SidebarInset>
          <main id="main-content" key={pathname} className="flex flex-col h-full page-fade-in">
            {isNavigating ? <PageSkeleton /> : children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
