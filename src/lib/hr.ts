import type { Employee, EmploymentStatus } from '@/types';

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Intern', 'Contractor'] as const;
export const EMPLOYMENT_STATUSES = ['Onboarding', 'Active', 'On Leave', 'Resigned', 'Terminated'] as const;

export function statusBadgeVariant(status?: EmploymentStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Active': return 'default';
    case 'Onboarding': return 'secondary';
    case 'On Leave': return 'outline';
    case 'Resigned':
    case 'Terminated': return 'destructive';
    default: return 'default';
  }
}

/**
 * Recursively removes `undefined` values (Firestore rejects them anywhere in a
 * document, and the collection hook only strips them at the top level).
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)])
    ) as T;
  }
  return value;
}

export function nextEmployeeCode(employees: Employee[]): string {
  const maxNum = employees.reduce((max, e) => {
    const match = e.employeeCode?.match(/^EMP-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `EMP-${String(maxNum + 1).padStart(4, '0')}`;
}
