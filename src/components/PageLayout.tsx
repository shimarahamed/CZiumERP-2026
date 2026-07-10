'use client';

import { cn } from '@/lib/utils';

/**
 * Standard page shell — wraps every page's content area with consistent
 * mobile-safe padding and overflow handling.
 */
export function PageLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {children}
    </div>
  );
}

/**
 * Standard main content area — consistent padding across all screen sizes.
 * Use instead of raw <main className="flex-1 overflow-auto p-4 md:p-6">.
 */
export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 overflow-auto p-3 sm:p-4 md:p-6', className)}>
      {children}
    </div>
  );
}

/**
 * Standard action bar row — search inputs + action buttons.
 * Stacks vertically on mobile, horizontal on sm+.
 */
export function PageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4', className)}>
      {children}
    </div>
  );
}
