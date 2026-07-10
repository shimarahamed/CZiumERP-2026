
'use client';

import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-muted-foreground px-4 md:px-6 py-2 border-b bg-card/50', className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-foreground hover:underline transition-colors truncate max-w-[120px] sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', isLast && 'text-foreground font-medium')}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
