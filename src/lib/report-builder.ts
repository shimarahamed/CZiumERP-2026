import type { ReportAggregate, ReportDefinition, ReportFilter, ReportSource } from '@/types';

// The columns a user can pick from per source — a deliberate allowlist (flat,
// primitive-valued fields only) rather than exposing every nested field on every
// document type, so the builder stays simple to use and to render as a table.
export const REPORT_SOURCE_COLUMNS: Record<ReportSource, string[]> = {
  invoices: ['id', 'date', 'status', 'customerName', 'amount', 'storeId', 'currency'],
  products: ['id', 'name', 'sku', 'category', 'price', 'cost', 'stock', 'vendorId'],
  customers: ['id', 'name', 'company', 'email', 'tier', 'storeId'],
  vendors: ['id', 'name', 'contactPerson', 'email', 'leadTimeDays'],
  purchaseOrders: ['id', 'vendorName', 'status', 'orderDate', 'totalCost', 'storeId', 'currency'],
  ledgerEntries: ['id', 'date', 'account', 'description', 'debit', 'credit', 'storeId'],
  vendorBills: ['id', 'vendorName', 'purchaseOrderId', 'amount', 'status', 'billDate', 'dueDate'],
};

const NUMERIC_OPERATORS = new Set(['gt', 'lt', 'gte', 'lte']);

function getField(row: Record<string, unknown>, field: string): unknown {
  return row[field];
}

function matchesFilter(row: Record<string, unknown>, filter: ReportFilter): boolean {
  const raw = getField(row, filter.field);
  if (NUMERIC_OPERATORS.has(filter.operator)) {
    const num = typeof raw === 'number' ? raw : Number(raw);
    const target = Number(filter.value);
    if (Number.isNaN(num) || Number.isNaN(target)) return false;
    switch (filter.operator) {
      case 'gt': return num > target;
      case 'lt': return num < target;
      case 'gte': return num >= target;
      case 'lte': return num <= target;
      default: return true;
    }
  }
  const str = raw === undefined || raw === null ? '' : String(raw).toLowerCase();
  const target = filter.value.toLowerCase();
  switch (filter.operator) {
    case 'equals': return str === target;
    case 'notEquals': return str !== target;
    case 'contains': return str.includes(target);
    default: return true;
  }
}

function aggregate(values: number[], fn: ReportAggregate): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return 0;
  }
}

export type ReportRow = Record<string, unknown>;
export type ReportResultRow = { group: string; value: number } | ReportRow;

/**
 * Runs a ReportDefinition against an already-loaded array of documents (from
 * AppContext) — filters, then either returns the filtered/column-selected rows, or
 * groups + aggregates when groupByField/aggregate are set.
 */
export function runReport(definition: ReportDefinition, rows: ReportRow[]): ReportResultRow[] {
  const filtered = rows.filter(row => definition.filters.every(f => matchesFilter(row, f)));

  if (definition.groupByField && definition.aggregate) {
    const groups = new Map<string, number[]>();
    for (const row of filtered) {
      const key = String(getField(row, definition.groupByField) ?? 'N/A');
      const raw = definition.aggregateField ? getField(row, definition.aggregateField) : 1;
      const num = typeof raw === 'number' ? raw : Number(raw) || 0;
      groups.set(key, [...(groups.get(key) ?? []), num]);
    }
    return [...groups.entries()]
      .map(([group, values]) => ({ group, value: aggregate(values, definition.aggregate!) }))
      .sort((a, b) => b.value - a.value);
  }

  return filtered.map(row => {
    const out: ReportRow = {};
    for (const col of definition.columns) out[col] = getField(row, col);
    return out;
  });
}
