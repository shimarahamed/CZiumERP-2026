export type StockAdjustmentMode = 'add' | 'remove' | 'set';

function normalizeStockValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function calculateStockAdjustment(
  currentStock: number,
  requestedQty: number,
  mode: StockAdjustmentMode,
) {
  const safeCurrentStock = normalizeStockValue(currentStock);
  const safeRequestedQty = normalizeStockValue(requestedQty);

  if (mode === 'set') {
    const nextStock = normalizeStockValue(safeRequestedQty);
    return {
      newStock: nextStock,
      appliedQty: nextStock - safeCurrentStock,
    };
  }

  if (mode === 'remove') {
    const nextStock = Math.max(0, safeCurrentStock - safeRequestedQty);
    return {
      newStock: nextStock,
      appliedQty: nextStock - safeCurrentStock,
    };
  }

  const nextStock = safeCurrentStock + safeRequestedQty;
  return {
    newStock: nextStock,
    appliedQty: safeRequestedQty,
  };
}
