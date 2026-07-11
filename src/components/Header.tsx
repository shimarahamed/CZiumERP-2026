
'use client';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Search, Bell, ChevronsUpDown, ArrowLeft, MailOpen, WifiOff, Wifi, X, Trash2 } from '@/components/icons';
import { Input } from './ui/input';
import type React from 'react';
import { useState } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useAppContext } from '@/context/AppContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from 'next/navigation';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PresenceAvatars } from '@/components/PresenceAvatars';

type HeaderProps = {
  title: string;
  children?: React.ReactNode;
  showBackButton?: boolean;
};

export default function Header({ title, children, showBackButton = false }: HeaderProps) {
  const {
    currentStore, stores, selectStore, user,
    notifications, markNotificationAsRead, markAllNotificationsAsRead,
    dismissNotification, clearAllNotifications,
  } = useAppContext();
  const router = useRouter();
  
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  const handleStoreChange = (storeId: string) => {
    selectStore(storeId);
  }
  
  const handleSwitchStore = () => {
    router.push('/select-store');
  }

  const handleNotificationClick = (notification: { id: string, href?: string }) => {
    markNotificationAsRead(notification.id);
    if (notification.href) {
      router.push(notification.href);
    }
  }

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  // All-Stores (global) view is available to admins/managers, and to any user
  // the admin left without a pinned store — those users operate across all stores.
  const canViewAllStores = isAdminOrManager || !user?.storeId;

  const isOnline = useOnlineStatus();
  const isCheckingConnection = isOnline === null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <SidebarTrigger />
        {showBackButton && (
            <Button variant="outline" size="icon" aria-label="Go back" className="h-8 w-8" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
        )}
        <h1 className="text-lg md:text-xl font-semibold truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 max-w-[110px] sm:max-w-[200px] shrink">
                   <span className="truncate">{currentStore?.name || "No Store Selected"}</span>
                   <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Switch Store</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canViewAllStores && (
                  <DropdownMenuItem onClick={() => handleStoreChange('all')} disabled={currentStore?.id === 'all'}>
                    All Stores
                  </DropdownMenuItem>
                )}
                {stores.map(store => (
                    <DropdownMenuItem key={store.id} onClick={() => handleStoreChange(store.id)} disabled={store.id === currentStore?.id}>
                        {store.name}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSwitchStore}>
                  Change Store Session
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* Page shortcuts are secondary (all reachable via nav) — hidden on phones to keep the header from overflowing. */}
        {children && <div className="hidden sm:flex items-center gap-2 md:gap-4">{children}</div>}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0",
                  isCheckingConnection
                    ? "text-muted-foreground bg-muted/50 border-border"
                    : isOnline
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-destructive bg-destructive/10 border-destructive/20"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isCheckingConnection ? "bg-muted-foreground" : isOnline ? "bg-emerald-500" : "bg-destructive animate-pulse")} />
                {isCheckingConnection ? null : isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isCheckingConnection ? 'Checking' : isOnline ? 'Online' : 'Offline'}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isCheckingConnection
                ? 'Checking the internet connection.'
                : isOnline
                ? 'Connected — data is syncing live.'
                : 'You are offline. You can keep working with cached data — POS sales, invoices, and customers you add now will sync automatically once reconnected.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="hidden sm:block shrink-0"><PresenceAvatars /></div>
        <div className="shrink-0"><ThemeToggle /></div>
        {/* Desktop search bar */}
        <button
          type="button"
          aria-label="Open search (Ctrl+K)"
          onClick={() => {
            const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
            document.dispatchEvent(e);
          }}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-[200px] lg:w-[280px] shrink-0"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded border shrink-0">Ctrl K</kbd>
        </button>
        {/* Mobile search icon button */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open search"
          className="flex md:hidden rounded-full shrink-0"
          onClick={() => {
            const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
            document.dispatchEvent(e);
          }}
        >
          <Search className="h-5 w-5" />
        </Button>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-full relative shrink-0">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                            {unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(350px,calc(100vw-1rem))]">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 {(notifications || []).length > 0 ? (
                    <ScrollArea className="h-[300px]">
                        {notifications.map(notification => (
                        <div
                            key={notification.id}
                            className={cn("flex items-start gap-2 p-2 hover:bg-accent/50 cursor-pointer group rounded-sm", !notification.isRead && "bg-primary/5")}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between w-full gap-1">
                                    <p className="font-semibold text-sm truncate">{notification.title}</p>
                                    {!notification.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                                </div>
                                <p className="text-xs text-muted-foreground w-full text-wrap line-clamp-2">{notification.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</p>
                            </div>
                            <button
                                aria-label="Dismiss notification"
                                onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        ))}
                    </ScrollArea>
                    ) : (
                    <p className="p-4 text-sm text-muted-foreground text-center">No new notifications</p>
                    )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={markAllNotificationsAsRead} disabled={unreadCount === 0}>
                    <MailOpen className="mr-2 h-4 w-4" />
                    <span>Mark all as read</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={clearAllNotifications} disabled={(notifications || []).length === 0} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Clear all notifications</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
