import { format } from 'date-fns/format';

/**
 * UK-style date/time formatting used across documents (invoices, receipts).
 * Dates are dd/MM/yyyy and times are 24-hour HH:mm, matching en-GB conventions.
 */

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. 10/07/2026 */
export function formatDateUK(value: string | number | Date): string {
  const d = toDate(value);
  return isNaN(d.getTime()) ? '' : format(d, 'dd/MM/yyyy');
}

/** e.g. 10/07/2026 14:35 */
export function formatDateTimeUK(value: string | number | Date): string {
  const d = toDate(value);
  return isNaN(d.getTime()) ? '' : format(d, 'dd/MM/yyyy HH:mm');
}

/** e.g. 14:35:07 — for a receipt's issue time. */
export function formatTimeUK(value: string | number | Date): string {
  const d = toDate(value);
  return isNaN(d.getTime()) ? '' : format(d, 'HH:mm:ss');
}
