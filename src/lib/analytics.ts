/**
 * Analytics computations over existing collections. Pure functions, integer-cents.
 */
import { addMoney, mulMoney } from '@/lib/money';
import type { Invoice, Customer, Product, Vendor } from '@/types';

/** Customer Lifetime Value: total paid revenue per customer. */
export function customerLifetimeValue(invoices: Invoice[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.customerId) continue;
    m.set(inv.customerId, addMoney(m.get(inv.customerId) ?? 0, inv.amount));
  }
  return m;
}

/** Product profitability: revenue − cost per product from invoice lines. */
export function productProfitability(invoices: Invoice[]): { productId: string; productName: string; revenue: number; profit: number; units: number }[] {
  const map = new Map<string, { productName: string; revenue: number; profit: number; units: number }>();
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    for (const item of inv.items) {
      const cur = map.get(item.productId) ?? { productName: item.productName, revenue: 0, profit: 0, units: 0 };
      const rev = mulMoney(item.price, item.quantity);
      const cost = mulMoney(item.cost ?? 0, item.quantity);
      cur.revenue = addMoney(cur.revenue, rev);
      cur.profit = addMoney(cur.profit, rev, -cost);
      cur.units += item.quantity;
      map.set(item.productId, cur);
    }
  }
  return [...map.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.profit - a.profit);
}

/** Churn signal: customers with no paid invoice in the last N days. */
export function churnRisk(invoices: Invoice[], customers: Customer[], days = 90): Customer[] {
  const cutoff = Date.now() - days * 86400000;
  const lastPaid = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.customerId) continue;
    const t = new Date(inv.date).getTime();
    lastPaid.set(inv.customerId, Math.max(lastPaid.get(inv.customerId) ?? 0, t));
  }
  return customers.filter(c => {
    const t = lastPaid.get(c.id);
    return t !== undefined && t < cutoff;
  });
}

/** Outstanding balance per customer (unpaid invoices) — for credit-limit checks. */
export function outstandingByCustomer(invoices: Invoice[], customerId: string): number {
  return addMoney(...invoices.filter(i => i.customerId === customerId && i.status !== 'paid').map(i => i.amount), 0);
}

/** Supplier performance from vendor scorecards + product lead times. */
export function supplierPerformance(vendors: Vendor[]): { id: string; name: string; onTime: number; quality: number }[] {
  return vendors.map(v => ({
    id: v.id, name: v.name,
    onTime: v.scorecard?.onTimeRate ?? 0,
    quality: v.scorecard?.qualityRate ?? 0,
  })).sort((a, b) => (b.onTime + b.quality) - (a.onTime + a.quality));
}

/** Available (sellable) stock = stock − reserved. */
export function availableStock(p: Product): number {
  return Math.max(0, p.stock - (p.reservedStock ?? 0));
}
