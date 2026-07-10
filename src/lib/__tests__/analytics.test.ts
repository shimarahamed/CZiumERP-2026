import { describe, it, expect } from 'vitest';
import { customerLifetimeValue, productProfitability, churnRisk, outstandingByCustomer, availableStock } from '@/lib/analytics';
import type { Invoice, Customer, Product } from '@/types';

const inv = (id: string, customerId: string, status: string, amount: number, date: string, items: {productId:string;productName:string;quantity:number;price:number;cost:number}[] = []): Invoice =>
  ({ id, customerId, status: status as Invoice['status'], amount, date, items, currency: 'USD' } as Invoice);

describe('analytics', () => {
  const invoices = [
    inv('1', 'c1', 'paid', 100, '2026-06-01', [{ productId: 'p1', productName: 'Widget', quantity: 2, price: 30, cost: 20 }]),
    inv('2', 'c1', 'paid', 50, '2026-06-10'),
    inv('3', 'c2', 'pending', 200, '2026-06-15'),
  ];
  it('CLV sums paid invoices per customer', () => {
    expect(customerLifetimeValue(invoices).get('c1')).toBe(150);
    expect(customerLifetimeValue(invoices).get('c2')).toBeUndefined();
  });
  it('profitability computes revenue minus cost', () => {
    const p = productProfitability(invoices)[0];
    expect(p.revenue).toBe(60);
    expect(p.profit).toBe(20);
    expect(p.units).toBe(2);
  });
  it('outstanding counts unpaid only', () => {
    expect(outstandingByCustomer(invoices, 'c2')).toBe(200);
    expect(outstandingByCustomer(invoices, 'c1')).toBe(0);
  });
  it('churn flags stale customers', () => {
    const custs: Customer[] = [{ id: 'c1', name: 'A', email: '', phone: '', avatar: '' }];
    const old = [inv('9', 'c1', 'paid', 10, '2020-01-01')];
    expect(churnRisk(old, custs, 90).length).toBe(1);
  });
  it('available stock subtracts reserved', () => {
    expect(availableStock({ stock: 10, reservedStock: 3 } as Product)).toBe(7);
  });
});
