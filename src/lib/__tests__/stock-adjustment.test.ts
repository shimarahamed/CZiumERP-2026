import { describe, expect, it } from 'vitest';
import { calculateStockAdjustment } from '../stock-adjustment';

describe('calculateStockAdjustment', () => {
  it('adds stock when requested', () => {
    expect(calculateStockAdjustment(10, 3, 'add')).toEqual({ newStock: 13, appliedQty: 3 });
  });

  it('removes stock when requested', () => {
    expect(calculateStockAdjustment(10, 3, 'remove')).toEqual({ newStock: 7, appliedQty: -3 });
  });

  it('caps stock at zero when removal exceeds current stock', () => {
    expect(calculateStockAdjustment(5, 10, 'remove')).toEqual({ newStock: 0, appliedQty: -5 });
  });

  it('sets stock to an explicit value', () => {
    expect(calculateStockAdjustment(10, 4, 'set')).toEqual({ newStock: 4, appliedQty: -6 });
  });

  it('preserves decimal stock values while adding', () => {
    expect(calculateStockAdjustment(10.7, 3.9, 'add')).toEqual({ newStock: 14.6, appliedQty: 3.9 });
  });
});
