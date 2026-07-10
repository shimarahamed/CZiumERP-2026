import type { Product, InvoiceItem } from '@/types';

/**
 * Given the physical/service line items being sold, compute how many units of
 * each PHYSICAL product must be removed from stock. A product line consumes
 * itself; a service line consumes each of its linked products by
 * (link.quantity × line.quantity). Custom lines carry no productId and are
 * skipped. This mirrors the invoice page's `consumptionFor` so POS and invoice
 * sales decrement stock identically.
 */
export function computeStockConsumption(
  lines: { productId: string; quantity: number }[],
  products: Product[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    const p = products.find(pr => pr.id === line.productId);
    if (!p) continue;
    if (p.kind === 'service') {
      for (const link of p.serviceLinks ?? []) {
        map.set(link.productId, (map.get(link.productId) ?? 0) + link.quantity * line.quantity);
      }
    } else {
      map.set(p.id, (map.get(p.id) ?? 0) + line.quantity);
    }
  }
  return map;
}

/** Available stock a POS card should show: the product's own stock field. */
export function displayStock(product: Product): number {
  return product.stock;
}

/** Build the InvoiceItem for a catalogue product being sold at POS. */
export function toInvoiceItem(product: Product, quantity: number): InvoiceItem {
  return {
    productId: product.id,
    productName: product.name,
    quantity,
    price: product.price,
    cost: product.cost,
  };
}
