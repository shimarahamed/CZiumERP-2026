import { describe, it, expect } from 'vitest';
import { toCents, fromCents, addMoney, mulMoney, percentOf, formatMoney } from '@/lib/money';

describe('money (integer-cents arithmetic)', () => {
  it('round-trips cents', () => {
    expect(fromCents(toCents(19.99))).toBe(19.99);
  });
  it('avoids the classic float drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the JS problem
    expect(addMoney(0.1, 0.2)).toBe(0.3); // the fix
  });
  it('sums invoice lines exactly', () => {
    expect(addMoney(10.35, 4.65, 0.01)).toBe(15.01);
  });
  it('multiplies unit price by quantity', () => {
    expect(mulMoney(1.15, 3)).toBe(3.45);
  });
  it('computes percentages (5% VAT on 19.99)', () => {
    expect(percentOf(19.99, 5)).toBe(1);
  });
  it('formats with symbol', () => {
    expect(formatMoney(1234.5, 'AED ')).toBe('AED 1,234.50');
  });
});
