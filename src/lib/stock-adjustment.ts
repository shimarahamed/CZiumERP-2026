export type StockAdjustmentMode = 'add' | 'remove' | 'set';

export function calculateStockAdjustment(
  currentStock: number,
  requestedQty: number,
  mode: StockAdjustmentMode,
) {
  const safeCurrentStock = Number.isFinite(currentStock) ? currentStock : 0;
  const safeRequestedQty = Number.isFinite(requestedQty) ? requestedQty : 0;

  if (mode === 'set') {
    const nextStock = Math.max(0, safeRequestedQty);
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
