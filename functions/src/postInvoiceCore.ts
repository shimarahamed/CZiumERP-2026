import type {Firestore, DocumentReference} from "firebase-admin/firestore";
import {addMoney, mulMoney, percentOf, lineTotal} from "./money";
import {convertServerSide} from "./fxRates";

type Currency = "USD" | "EUR" | "JPY" | "GBP" | "AED" | "LKR";

export type InvoiceItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
  isCustom?: boolean;
  discount?: number;
  discountType?: "percent" | "amount";
};

export type Invoice = {
  id?: string;
  storeId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  userId?: string;
  userName?: string;
  items: InvoiceItem[];
  amount: number;
  status: string;
  date: string;
  dueDate?: string;
  discount?: number;
  taxRate?: number;
  currency?: string;
  paymentMethod?: "cash" | "card";
  createdAt?: string;
  notes?: string;
  salesperson?: string;
  customData?: Record<string, unknown>;
  // Outbox fields — set by the POS client on queued invoices and by the
  // postQueuedInvoice trigger once the sale is posted.
  postStatus?: "queued" | "posted" | "failed";
  clientRef?: string;
  predictedId?: string;
  postError?: string;
  postedAt?: string;
  invoicePrefix?: string;
  // Set by the client when the cashier/user explicitly chose to proceed
  // past a low/zero-stock warning at creation time. Lets stock go negative
  // instead of throwing at posting time.
  allowNegativeStock?: boolean;
};

type ProductDoc = {
  id?: string;
  name?: string;
  stock?: number;
  kind?: "product" | "service";
  serviceLinks?: {productId: string; quantity: number}[];
  trackingMode?: "none" | "lot" | "serial";
};

/**
 * Posting failure with an HttpsError-compatible code, so the callable can
 * rethrow it as an HttpsError and the Firestore trigger can record it on
 * the queued invoice document instead.
 */
export class PostingError extends Error {
  code: "failed-precondition" | "invalid-argument" | "internal";

  /**
   * @param {string} code HttpsError-compatible error code.
   * @param {string} message Human-readable failure reason.
   */
  constructor(
    code: "failed-precondition" | "invalid-argument" | "internal",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

/**
 * Parses the numeric suffix from an invoice id with the configured prefix.
 * @param {string | undefined} id Existing invoice id.
 * @param {string} prefix Invoice prefix.
 * @return {number} Parsed invoice number, or zero when not parseable.
 */
function parseInvoiceNumber(id: string | undefined, prefix: string): number {
  if (!id?.startsWith(prefix)) return 0;
  const parsed = Number(id.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : 0;
}

export type PostInvoiceOptions = {
  db: Firestore;
  tenantId: string;
  invoice: Invoice;
  invoicePrefix: string;
  /** Recorded as the actor on the activity log entry. */
  actor?: string;
  /**
   * Set when posting a client-queued invoice: the provisional document the
   * POS wrote while (possibly) offline. It is re-read inside the transaction
   * for idempotency (skip when already posted/deleted) and deleted in the
   * same transaction that creates the final numbered invoice.
   */
  queuedDocRef?: DocumentReference;
  /** Extra fields merged onto the final invoice doc (e.g. postStatus). */
  extraInvoiceFields?: Record<string, unknown>;
  /**
   * Invoice number the client predicted (shown on its receipt while queued).
   * The allocated number is max(counter + 1, requestedNumber), so the
   * prediction holds unless another sale claimed a number in between.
   */
  requestedNumber?: number;
};

export type PostInvoiceResult = {
  total: number;
  invoice: Invoice;
};

/**
 * The single source of truth for posting a paid invoice: validates the
 * tenant, checks + decrements stock (warehouse / lot / serial aware),
 * allocates the invoice number, computes authoritative totals (item
 * discounts → invoice discount → tax) and writes the balanced GL set —
 * all in one Firestore transaction. Used by both the postInvoiceWithLedger
 * callable and the postQueuedInvoice Firestore trigger.
 * @param {PostInvoiceOptions} opts Posting inputs.
 * @return {Promise<PostInvoiceResult | null>} The posted totals+invoice, or
 *   null when a queuedDocRef was supplied but is no longer queued (already
 *   handled by a previous delivery of the trigger event).
 */
export async function runInvoicePosting(
  opts: PostInvoiceOptions
): Promise<PostInvoiceResult | null> {
  const {db, tenantId, invoice, invoicePrefix, queuedDocRef} = opts;

  const hasItems = Array.isArray(invoice.items) && invoice.items.length > 0;
  if (!hasItems) {
    throw new PostingError(
      "invalid-argument",
      "Invoice with at least one item is required."
    );
  }

  const tenantRef = db.collection("tenants").doc(tenantId);

  return db.runTransaction(async (tx) => {
    // Idempotency guard for the trigger path: Firestore events are
    // delivered at-least-once, so a retry must find the queued doc gone
    // (deleted by the first successful run) and become a no-op.
    if (queuedDocRef) {
      const queuedSnap = await tx.get(queuedDocRef);
      if (!queuedSnap.exists || queuedSnap.data()?.postStatus !== "queued") {
        return null;
      }
    }

    const tenantSnap = await tx.get(tenantRef);
    const tenantData = tenantSnap.data();
    if (!tenantSnap.exists || tenantData?.status !== "active") {
      throw new PostingError("failed-precondition", "Tenant is not active.");
    }
    const enabledModules: string[] = tenantData?.enabledModules ?? [];
    if (!enabledModules.includes("Sales & Customers")) {
      throw new PostingError(
        "failed-precondition",
        "Sales & Customers module is not enabled."
      );
    }
    const financeEnabled = enabledModules.includes("Finance");

    const sellableItems = invoice.items.filter((item) => !item.isCustom);
    const soldProductIds = Array.from(
      new Set(sellableItems.map((item) => item.productId))
    );
    const soldProductRefs = new Map(soldProductIds.map((id) => [
      id,
      tenantRef.collection("products").doc(id),
    ]));
    const soldProductSnaps = await Promise.all(
      Array.from(soldProductRefs.values()).map((ref) => tx.get(ref))
    );
    const productsById = new Map<string, ProductDoc>();
    soldProductSnaps.forEach((snap, i) => {
      const productId = soldProductIds[i];
      if (!snap.exists) {
        throw new PostingError(
          "failed-precondition",
          `Product ${productId} not found.`
        );
      }
      const data = snap.data();
      if (!data) {
        throw new PostingError("internal", "Product data missing.");
      }
      productsById.set(productId, {id: productId, ...data} as ProductDoc);
    });

    const linkedProductIds = new Set<string>();
    sellableItems.forEach((item) => {
      const product = productsById.get(item.productId);
      if (product?.kind === "service") {
        (product.serviceLinks ?? []).forEach((link) => {
          linkedProductIds.add(link.productId);
        });
      }
    });
    const missingLinkedIds = Array.from(linkedProductIds)
      .filter((id) => !productsById.has(id));
    const linkedProductRefs = new Map(missingLinkedIds.map((id) => [
      id,
      tenantRef.collection("products").doc(id),
    ]));
    const linkedSnaps = await Promise.all(
      Array.from(linkedProductRefs.values()).map((ref) => tx.get(ref))
    );
    linkedSnaps.forEach((snap, i) => {
      const productId = missingLinkedIds[i];
      if (!snap.exists) {
        throw new PostingError(
          "failed-precondition",
          `Linked product ${productId} not found.`
        );
      }
      productsById.set(productId, {
        id: productId,
        ...snap.data(),
      } as ProductDoc);
    });

    const consumption = new Map<string, number>();
    sellableItems.forEach((item) => {
      const product = productsById.get(item.productId);
      if (product?.kind === "service") {
        (product.serviceLinks ?? []).forEach((link) => {
          consumption.set(
            link.productId,
            (consumption.get(link.productId) ?? 0) +
              link.quantity * item.quantity
          );
        });
      } else {
        consumption.set(
          item.productId,
          (consumption.get(item.productId) ?? 0) + item.quantity
        );
      }
    });
    const consumedProductIds = Array.from(consumption.keys());
    const consumedProductRefs = consumedProductIds.map((id) =>
      tenantRef.collection("products").doc(id)
    );

    // Resolve the warehouse to decrement from: the one linked to the
    // invoice's store, else the tenant's default warehouse, else fall back
    // to the legacy behavior of decrementing Product.stock directly
    // (pre-warehouse tenants).
    type WarehouseDoc = {id: string; storeId?: string; isDefault?: boolean};
    const warehousesSnap = await tx.get(tenantRef.collection("warehouses"));
    const warehouseDocs: WarehouseDoc[] = warehousesSnap.docs.map(
      (d) => ({id: d.id, ...d.data()} as WarehouseDoc)
    );
    const matchedWarehouse = invoice.storeId ?
      warehouseDocs.find((w) => w.storeId === invoice.storeId) :
      undefined;
    const defaultWarehouse = warehouseDocs.find((w) => w.isDefault) ??
      warehouseDocs[0];
    const warehouse = matchedWarehouse ?? defaultWarehouse;

    // Resolve the posting store's functional currency: the store linked to
    // the invoice, if it has one set, else USD (the app's currency display
    // preference is browser-local only, never written to the tenant doc, so
    // there is nothing authoritative to fall back to server-side). If the
    // invoice's own currency differs from the resolved posting currency,
    // amounts are converted before being written as debit/credit — a no-op
    // for every tenant that never sets Store.functionalCurrency (the
    // overwhelmingly common case today).
    type StoreDoc = {functionalCurrency?: Currency};
    const storeSnap = invoice.storeId ?
      await tx.get(tenantRef.collection("stores").doc(invoice.storeId)) :
      undefined;
    const storeData = storeSnap?.data() as StoreDoc | undefined;
    const postingCurrency: Currency = storeData?.functionalCurrency ?? "USD";
    const invoiceCurrency = (invoice.currency as Currency | undefined) ??
      postingCurrency;
    const needsConversion =
      financeEnabled && invoiceCurrency !== postingCurrency;
    const fx = needsConversion ?
      await convertServerSide(1, invoiceCurrency, postingCurrency) :
      {converted: 1, rate: 1};

    const stockLevelRefs = warehouse ?
      consumedProductIds.map((productId) => tenantRef.collection("stockLevels")
        .doc(`${productId}_${warehouse.id}`)) :
      [];
    const stockLevelSnaps = warehouse ?
      await Promise.all(stockLevelRefs.map((ref) => tx.get(ref))) :
      [];

    consumedProductIds.forEach((productId, i) => {
      const product = productsById.get(productId);
      const needed = consumption.get(productId) ?? 0;
      const levelStock =
        stockLevelSnaps[i]?.data()?.stock as number | undefined;
      const productStock = product?.stock ?? 0;
      const available = warehouse ?
        Math.max(productStock, levelStock ?? productStock) :
        productStock;
      if (needed > available && !invoice.allowNegativeStock) {
        throw new PostingError(
          "failed-precondition",
          `Insufficient stock for ${product?.name ?? productId}. ` +
            `Available: ${available}.`
        );
      }
    });

    // Lot/serial-tracked products additionally decrement their detail rows,
    // FEFO for lots (oldest expiry first) / oldest-received-first for
    // serials — same selection order as the client-side fallback in
    // src/app/invoices/page.tsx. All reads happen up front (transaction
    // rule: reads before writes); the actual doc writes happen alongside
    // the stockLevel writes below.
    type LotDoc = {
      id: string; quantity: number; expiryDate?: string; receivedAt: string;
    };
    type SerialDoc = {id: string; status: string; receivedAt: string};
    const lotPlans: Record<number, {ref: FirebaseFirestore.DocumentReference;
      newQuantity: number}[]> = {};
    const serialPlans: Record<number,
      FirebaseFirestore.DocumentReference[]> = {};

    if (warehouse) {
      for (let i = 0; i < consumedProductIds.length; i++) {
        const productId = consumedProductIds[i];
        const product = productsById.get(productId);
        const trackingMode = product?.trackingMode;
        const qty = consumption.get(productId) ?? 0;

        if (trackingMode === "lot") {
          const lotsSnap = await tx.get(
            tenantRef.collection("lots")
              .where("productId", "==", productId)
              .where("warehouseId", "==", warehouse.id)
          );
          const candidates = lotsSnap.docs
            .map((d) => ({id: d.id, ...d.data()} as LotDoc))
            .filter((l) => l.quantity > 0)
            .sort((a, b) => (a.expiryDate ?? "￿")
              .localeCompare(b.expiryDate ?? "￿"));
          let remaining = qty;
          const plan: {ref: FirebaseFirestore.DocumentReference;
            newQuantity: number}[] = [];
          for (const lot of candidates) {
            if (remaining <= 0) break;
            const take = Math.min(lot.quantity, remaining);
            plan.push({
              ref: tenantRef.collection("lots").doc(lot.id),
              newQuantity: lot.quantity - take,
            });
            remaining -= take;
          }
          // Aggregate stock was already checked above; historical stock may
          // not have matching lot rows, so do not block on lot detail gaps.
          lotPlans[i] = plan;
        } else if (trackingMode === "serial") {
          const serialsSnap = await tx.get(
            tenantRef.collection("serialUnits")
              .where("productId", "==", productId)
              .where("warehouseId", "==", warehouse.id)
              .where("status", "==", "in-stock")
          );
          const candidates = serialsSnap.docs
            .map((d) => ({id: d.id, ...d.data()} as SerialDoc))
            .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
            .slice(0, qty);
          if (candidates.length < qty) {
            throw new PostingError(
              "failed-precondition",
              "Insufficient serial stock for " +
                `${product?.name ?? productId}.`
            );
          }
          serialPlans[i] = candidates.map((c) =>
            tenantRef.collection("serialUnits").doc(c.id));
        }
      }
    }

    // Net of each line's own item-level discount; the invoice-level %
    // discount below applies on top of that net figure, matching the
    // client-side calc in src/app/invoices/page.tsx / src/app/pos/page.tsx.
    const netSubtotal = addMoney(
      ...invoice.items.map((item) =>
        lineTotal(item.price, item.quantity, item.discount, item.discountType)
      )
    );
    const cogsInvoiceCcy = addMoney(
      ...invoice.items.map((item) => mulMoney(item.cost, item.quantity))
    );
    const discount =
      invoice.discount ? percentOf(netSubtotal, invoice.discount) : 0;
    const taxableInvoiceCcy = addMoney(netSubtotal, -discount);
    const taxInvoiceCcy = invoice.taxRate ?
      percentOf(taxableInvoiceCcy, invoice.taxRate) : 0;
    const totalInvoiceCcy = addMoney(taxableInvoiceCcy, taxInvoiceCcy);

    // All amounts recorded on the invoice document itself stay in the
    // invoice's own currency (what the customer was actually billed).
    // Ledger debit/credit convert to the posting store's functional
    // currency — see the `fx` comment above. addMoney rounds through
    // integer cents, so scale by fx.rate first then re-round via
    // addMoney(x, 0) to avoid float drift in the stored ledger amounts.
    const total = addMoney(totalInvoiceCcy * fx.rate, 0);
    const taxable = addMoney(taxableInvoiceCcy * fx.rate, 0);
    const tax = addMoney(taxInvoiceCcy * fx.rate, 0);
    const cogs = addMoney(cogsInvoiceCcy * fx.rate, 0);

    const counterRef = tenantRef.collection("counters").doc("invoice");
    const counterSnap = await tx.get(counterRef);
    const counterValue =
      counterSnap.exists ? (counterSnap.data()?.value as number) : 0;
    const requestedNumber = opts.requestedNumber ??
      parseInvoiceNumber(invoice.id, invoicePrefix);
    const nextNumber = Math.max((counterValue ?? 0) + 1, requestedNumber);
    const invoiceId = invoice.id?.trim() ||
      `${invoicePrefix}${String(nextNumber).padStart(3, "0")}`;

    const invoiceRef = tenantRef.collection("invoices").doc(invoiceId);
    const savedInvoice = {
      ...invoice,
      ...(opts.extraInvoiceFields ?? {}),
      id: invoiceId,
      amount: totalInvoiceCcy,
      status: invoice.status ?? "paid",
      createdAt: invoice.createdAt ?? new Date().toISOString(),
    };
    tx.set(invoiceRef, savedInvoice);

    // Replace the provisional client-queued doc with the final numbered
    // invoice atomically — the client reconciles via the clientRef field.
    if (queuedDocRef && queuedDocRef.path !== invoiceRef.path) {
      tx.delete(queuedDocRef);
    }

    tx.set(counterRef, {value: nextNumber}, {merge: true});

    consumedProductRefs.forEach((ref, i) => {
      const productId = consumedProductIds[i];
      const product = productsById.get(productId);
      const qty = consumption.get(productId) ?? 0;
      const currentStock = product?.stock ?? 0;
      const newStock = currentStock - qty;
      tx.update(ref, {stock: newStock});
      if (warehouse) {
        const levelStock =
          stockLevelSnaps[i]?.data()?.stock as number | undefined;
        const baseline = levelStock ?? currentStock;
        tx.set(stockLevelRefs[i], {
          id: `${productId}_${warehouse.id}`,
          productId: productId,
          warehouseId: warehouse.id,
          stock: baseline - qty,
          updatedAt: new Date().toISOString(),
        });
        lotPlans[i]?.forEach((p) => {
          tx.update(p.ref, {quantity: p.newQuantity});
        });
        serialPlans[i]?.forEach((serialRef) => {
          tx.update(serialRef, {
            status: "sold",
            invoiceId,
            soldAt: new Date().toISOString(),
          });
        });
      }
    });

    if (financeEnabled) {
      const ledgerRef = tenantRef.collection("ledgerEntries");
      const date = invoice.date;
      const storeId = invoice.storeId;
      const fxFields = needsConversion ?
        {transactionCurrency: invoiceCurrency, fxRateToFunctional: fx.rate} :
        {};

      tx.set(ledgerRef.doc(), {
        date,
        account: "Accounts Receivable",
        description: `Invoice ${invoiceId}`,
        debit: total,
        credit: 0,
        storeId,
        ...fxFields,
        ...(needsConversion ? {functionalAmount: total} : {}),
      });
      tx.set(ledgerRef.doc(), {
        date,
        account: "Sales Revenue",
        description: `Invoice ${invoiceId}`,
        debit: 0,
        credit: taxable,
        storeId,
        ...fxFields,
        ...(needsConversion ? {functionalAmount: taxable} : {}),
      });
      if (tax > 0) {
        tx.set(ledgerRef.doc(), {
          date,
          account: "Taxes Payable",
          description: `Invoice ${invoiceId} tax`,
          debit: 0,
          credit: tax,
          storeId,
          ...fxFields,
          ...(needsConversion ? {functionalAmount: tax} : {}),
        });
      }
      tx.set(ledgerRef.doc(), {
        date,
        account: "Cost of Goods Sold",
        description: `Invoice ${invoiceId}`,
        debit: cogs,
        credit: 0,
        storeId,
        ...fxFields,
        ...(needsConversion ? {functionalAmount: cogs} : {}),
      });
      tx.set(ledgerRef.doc(), {
        date,
        account: "Inventory",
        description: `Invoice ${invoiceId}`,
        debit: 0,
        credit: cogs,
        storeId,
        ...fxFields,
        ...(needsConversion ? {functionalAmount: cogs} : {}),
      });
    }

    tx.set(tenantRef.collection("activityLogs").doc(), {
      timestamp: new Date().toISOString(),
      user: opts.actor ?? "system",
      action: "Invoice Posted",
      details: financeEnabled ?
        `Posted invoice #${invoiceId} with ledger entries.` :
        `Posted invoice #${invoiceId}; ` +
          "Finance module disabled, ledger skipped.",
    });

    return {total, invoice: savedInvoice};
  });
}
