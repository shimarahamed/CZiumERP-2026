import type { Lot, SerialStatus, SerialUnit, StockLevel, Warehouse } from '@/types';

export function stockLevelId(productId: string, warehouseId: string): string {
  return `${productId}_${warehouseId}`;
}

/** Sum of stock for a product across all warehouses — the value Product.stock should mirror. */
export function totalStock(productId: string, stockLevels: StockLevel[]): number {
  return stockLevels.filter(s => s.productId === productId).reduce((sum, s) => sum + s.stock, 0);
}

/** The tenant's default warehouse (auto-created on first use), or undefined if none seeded yet. */
export function getDefaultWarehouse(warehouses: Warehouse[]): Warehouse | undefined {
  return warehouses.find(w => w.isDefault) ?? warehouses[0];
}

type StockLevelContext = {
  stockLevels: StockLevel[];
  setStockLevels: (updater: StockLevel[] | ((prev: StockLevel[]) => StockLevel[])) => void;
};

/**
 * Adjusts a product's stock at a specific warehouse by `delta` (positive to add, negative
 * to subtract), creating the StockLevel doc if it doesn't exist yet. This is the one place
 * that should ever write to StockLevel — every warehouse-aware stock movement (PO receiving,
 * manufacturing consumption, invoice decrement, cycle count) goes through this function so
 * the shape of a stock movement is consistent everywhere.
 *
 * `baselineStock` matters the FIRST time a product is moved at a warehouse that has no
 * StockLevel row yet: the row is seeded to `baselineStock + delta` so the warehouse figure
 * starts from the product's existing on-hand quantity, not from zero. Without it, the very
 * first sale of a product would create a row at just `delta` (e.g. -1), and every subsequent
 * availability check would then read a bogusly-low warehouse figure and wrongly block the
 * sale even though the product still has plenty of stock. Callers that know the product's
 * current stock (sales/consumption) should always pass it.
 */
export function adjustStock(
  ctx: StockLevelContext,
  productId: string,
  warehouseId: string,
  delta: number,
  baselineStock = 0,
): void {
  ctx.setStockLevels(prev => {
    const id = stockLevelId(productId, warehouseId);
    const existing = prev.find(s => s.id === id);
    if (existing) {
      return prev.map(s => s.id === id ? { ...s, stock: s.stock + delta, updatedAt: new Date().toISOString() } : s);
    }
    return [...prev, { id, productId, warehouseId, stock: baselineStock + delta, updatedAt: new Date().toISOString() }];
  });
}

/** Sets (not adjusts) a product's stock at a specific warehouse to an absolute value — used by cycle counts. */
export function setStock(ctx: StockLevelContext, productId: string, warehouseId: string, value: number): void {
  ctx.setStockLevels(prev => {
    const id = stockLevelId(productId, warehouseId);
    const existing = prev.find(s => s.id === id);
    if (existing) {
      return prev.map(s => s.id === id ? { ...s, stock: value, updatedAt: new Date().toISOString() } : s);
    }
    return [...prev, { id, productId, warehouseId, stock: value, updatedAt: new Date().toISOString() }];
  });
}

// ---------------- Lot tracking ----------------

export function lotId(productId: string, lotNumber: string, warehouseId: string): string {
  return `${productId}_${lotNumber}_${warehouseId}`;
}

type LotContext = StockLevelContext & {
  lots: Lot[];
  setLots: (updater: Lot[] | ((prev: Lot[]) => Lot[])) => void;
};

/**
 * Receives a quantity of a lot-tracked product into a specific lot number at a warehouse
 * (creating the lot if it's the first receipt of that lot number there), and keeps
 * StockLevel in sync via adjustStock — same "one place that writes StockLevel" contract
 * as the untracked flow.
 */
export function receiveLot(
  ctx: LotContext,
  productId: string,
  warehouseId: string,
  lotNumber: string,
  quantity: number,
  expiryDate?: string
): void {
  const id = lotId(productId, lotNumber, warehouseId);
  ctx.setLots(prev => {
    const existing = prev.find(l => l.id === id);
    if (existing) {
      return prev.map(l => l.id === id ? { ...l, quantity: l.quantity + quantity, expiryDate: expiryDate ?? l.expiryDate } : l);
    }
    return [...prev, { id, productId, warehouseId, lotNumber, quantity, expiryDate, receivedAt: new Date().toISOString() }];
  });
  adjustStock(ctx, productId, warehouseId, quantity);
}

/**
 * Consumes `quantity` from lots of a product at a warehouse, oldest-expiry-first (FEFO —
 * first-expired, first-out), the standard default for perishable/dated stock. Lots with no
 * expiryDate are treated as consumed last. Throws if the warehouse's lots don't have enough
 * quantity in total — callers should check availability before calling this.
 */
export function consumeLotFEFO(
  ctx: LotContext,
  productId: string,
  warehouseId: string,
  quantity: number
): void {
  const candidates = ctx.lots
    .filter(l => l.productId === productId && l.warehouseId === warehouseId && l.quantity > 0 && !l.deletedAt)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });

  let remaining = quantity;
  const consumedByLotId: Record<string, number> = {};
  for (const lot of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    consumedByLotId[lot.id] = take;
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(`Insufficient lot stock for product ${productId} at warehouse ${warehouseId}.`);
  }

  ctx.setLots(prev => prev.map(l =>
    consumedByLotId[l.id] ? { ...l, quantity: l.quantity - consumedByLotId[l.id] } : l
  ));
  adjustStock(ctx, productId, warehouseId, -quantity);
}

// ---------------- Serial tracking ----------------

type SerialContext = StockLevelContext & {
  serialUnits: SerialUnit[];
  setSerialUnits: (updater: SerialUnit[] | ((prev: SerialUnit[]) => SerialUnit[])) => void;
};

/** Registers newly received serial numbers for a product at a warehouse as 'in-stock' and increments StockLevel. */
export function receiveSerials(
  ctx: SerialContext,
  productId: string,
  warehouseId: string,
  serialNumbers: string[]
): void {
  const now = new Date().toISOString();
  ctx.setSerialUnits(prev => [
    ...prev,
    ...serialNumbers.map((serialNumber): SerialUnit => ({
      id: serialNumber,
      productId,
      warehouseId,
      serialNumber,
      status: 'in-stock',
      receivedAt: now,
    })),
  ]);
  adjustStock(ctx, productId, warehouseId, serialNumbers.length);
}

/** Flips a serial unit's status (e.g. to 'sold' on invoice, 'returned' on a return) and adjusts StockLevel accordingly. */
export function setSerialStatus(
  ctx: SerialContext,
  serialId: string,
  status: SerialStatus,
  invoiceId?: string
): void {
  const unit = ctx.serialUnits.find(s => s.id === serialId);
  if (!unit) return;
  const wasCounted = unit.status === 'in-stock' || unit.status === 'reserved';
  const nowCounted = status === 'in-stock' || status === 'reserved';
  ctx.setSerialUnits(prev => prev.map(s => s.id === serialId ? {
    ...s,
    status,
    invoiceId: status === 'sold' ? invoiceId : s.invoiceId,
    soldAt: status === 'sold' ? new Date().toISOString() : s.soldAt,
  } : s));
  if (wasCounted && !nowCounted) {
    adjustStock(ctx, unit.productId, unit.warehouseId, -1);
  } else if (!wasCounted && nowCounted) {
    adjustStock(ctx, unit.productId, unit.warehouseId, 1);
  }
}
