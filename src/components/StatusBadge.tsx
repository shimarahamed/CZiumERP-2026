'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const STATUS_MAP: Record<string, StatusVariant> = {
  // Positive / complete
  paid: 'success',
  active: 'success',
  completed: 'success',
  approved: 'success',
  resolved: 'success',
  delivered: 'success',
  passed: 'success',
  hired: 'success',
  present: 'success',
  accepted: 'success',

  // Pending reads as "awaiting", not an error — blue (info) instead of amber.
  pending: 'info',

  // Warning / in progress
  'in-progress': 'warning',
  'in progress': 'warning',
  partial: 'warning',
  open: 'warning',
  draft: 'warning',
  review: 'warning',
  late: 'warning',

  // Danger / negative
  overdue: 'danger',
  cancelled: 'danger',
  rejected: 'danger',
  failed: 'danger',
  absent: 'danger',
  unpaid: 'danger',
  closed: 'danger',

  // Info
  'in-transit': 'info',
  'in transit': 'info',
  sent: 'info',
  shipped: 'info',
  processing: 'info',
  scheduled: 'info',

  // Neutral
  inactive: 'neutral',
  archived: 'neutral',
  new: 'neutral',

  // Purple / special
  prospect: 'purple',
  qualified: 'purple',
  negotiation: 'purple',
};

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  danger:  'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  info:    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  purple:  'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase().trim();
  const variant = STATUS_MAP[key] ?? 'neutral';
  return (
    <Badge
      variant="outline"
      className={cn('capitalize font-medium', VARIANT_CLASSES[variant], className)}
    >
      {status}
    </Badge>
  );
}
