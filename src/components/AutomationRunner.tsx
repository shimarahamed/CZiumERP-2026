'use client';

import { useReorderTriggers } from '@/hooks/use-reorder-triggers';
import { useRecurringInvoices } from '@/hooks/use-recurring-invoices';

/**
 * Mounts automation hooks in a single component so layout.tsx stays clean.
 * Renders nothing — side-effects only.
 */
export function AutomationRunner() {
  useReorderTriggers();
  useRecurringInvoices();
  return null;
}
