import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {addMoney, mulMoney, percentOf} from "./money";
import {convertServerSide} from "./fxRates";

type Currency = "USD" | "EUR" | "JPY" | "GBP" | "AED" | "LKR";

type InvoiceItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
};

type Invoice = {
  id: string;
  storeId?: string;
  customerId?: string;
  customerName?: string;
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
};

export const postInvoiceWithLedger = onCall(async (request) => {
  const callerToken = request.auth?.token;
  if (!callerToken) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }

  const tenantId = callerToken.tenantId as string | undefined;
  const callerRole = callerToken.role as string | undefined;
  const validRoles = ["admin", "manager", "cashier", "inventory-staff"];
  if (!tenantId || !callerRole || !validRoles.includes(callerRole)) {
    throw new HttpsError(
      "permission-denied",
      "Not authorized to post invoices."
    );
  }

  const invoice = (request.data ?? {}).invoice as Invoice | undefined;
  const hasItems = invoice && Array.isArray(invoice.items) &&
    invoice.items.length > 0;
  if (!hasItems || !invoice) {
    throw new HttpsError(
      "invalid-argument",
      "Invoice with at least one item is required."
    );
  }

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);

  const result = await db.runTransaction(async (tx) => {
    const tenantSnap = await tx.get(tenantRef);
    const tenantData = tenantSnap.data();
    if (!tenantSnap.exists || tenantData?.status !== "active") {
      throw new HttpsError("failed-precondition", "Tenant is not active.");
    }
    const enabledModules: string[] = tenantData?.enabledModules ?? [];
    if (!enabledModules.includes("Sales & Customers")) {
      throw new HttpsError(
        "failed-precondition",
        "Sales & Customers module is not enabled."
      );
    }
    if (!enabledModules.includes("Financial Management")) {
      throw new HttpsError(
        "failed-precondition",
        "Financial Management module is not enabled."
      );
    }

    const productRefs = invoice.items.map((item) =>
      tenantRef.collection("products").doc(item.productId)
    );
    const productSnaps =
      await Promise.all(productRefs.map((ref) => tx.get(ref)));

    const products = productSnaps.map((snap, i) => {
      if (!snap.exists) {
        throw new HttpsError(
          "failed-precondition",
          `Product ${invoice.items[i].productId} not found.`
        );
      }
      const data = snap.data();
      if (!data) {
        throw new HttpsError("internal", "Product data missing.");
      }
      return data;
    });

    // Resolve the warehouse to decrement from: the one linked to the invoice's
    // store, else the tenant's default warehouse, else fall back to the legacy
    // behavior of decrementing Product.stock directly (pre-warehouse tenants).
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
    const needsConversion = invoiceCurrency !== postingCurrency;
    const fx = needsConversion ?
      await convertServerSide(1, invoiceCurrency, postingCurrency) :
      {converted: 1, rate: 1};

    const stockLevelRefs = warehouse ?
      invoice.items.map((item) => tenantRef.collection("stockLevels")
        .doc(`${item.productId}_${warehouse.id}`)) :
      [];
    const stockLevelSnaps = warehouse ?
      await Promise.all(stockLevelRefs.map((ref) => tx.get(ref))) :
      [];

    invoice.items.forEach((item, i) => {
      const levelStock =
        stockLevelSnaps[i]?.data()?.stock as number | undefined;
      const available = warehouse ?
        (levelStock ?? 0) :
        ((products[i].stock as number) ?? 0);
      if (item.quantity > available) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient stock for ${item.productName}. ` +
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
      for (let i = 0; i < invoice.items.length; i++) {
        const trackingMode = products[i].trackingMode as string | undefined;
        const productId = invoice.items[i].productId;
        const qty = invoice.items[i].quantity;

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
          if (remaining > 0) {
            throw new HttpsError(
              "failed-precondition",
              `Insufficient lot stock for ${invoice.items[i].productName}.`
            );
          }
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
            throw new HttpsError(
              "failed-precondition",
              "Insufficient serial stock for " +
                `${invoice.items[i].productName}.`
            );
          }
          serialPlans[i] = candidates.map((c) =>
            tenantRef.collection("serialUnits").doc(c.id));
        }
      }
    }

    const subtotal = addMoney(
      ...invoice.items.map((item) => mulMoney(item.price, item.quantity))
    );
    const cogsInvoiceCcy = addMoney(
      ...invoice.items.map((item) => mulMoney(item.cost, item.quantity))
    );
    const discount =
      invoice.discount ? percentOf(subtotal, invoice.discount) : 0;
    const taxableInvoiceCcy = addMoney(subtotal, -discount);
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
    const nextNumber = (counterValue ?? 0) + 1;

    const invoiceRef = tenantRef.collection("invoices").doc(invoice.id);
    tx.set(invoiceRef, {
      ...invoice,
      amount: totalInvoiceCcy,
      status: invoice.status ?? "paid",
    });

    tx.set(counterRef, {value: nextNumber}, {merge: true});

    productRefs.forEach((ref, i) => {
      const currentStock = products[i].stock as number;
      const newStock = currentStock - invoice.items[i].quantity;
      tx.update(ref, {stock: newStock});
      if (warehouse) {
        const levelStock =
          stockLevelSnaps[i]?.data()?.stock as number | undefined;
        const productId = invoice.items[i].productId;
        tx.set(stockLevelRefs[i], {
          id: `${productId}_${warehouse.id}`,
          productId: productId,
          warehouseId: warehouse.id,
          stock: (levelStock ?? 0) - invoice.items[i].quantity,
          updatedAt: new Date().toISOString(),
        });
        lotPlans[i]?.forEach((p) => {
          tx.update(p.ref, {quantity: p.newQuantity});
        });
        serialPlans[i]?.forEach((ref) => {
          tx.update(ref, {
            status: "sold",
            invoiceId: invoice.id,
            soldAt: new Date().toISOString(),
          });
        });
      }
    });

    const ledgerRef = tenantRef.collection("ledgerEntries");
    const date = invoice.date;
    const storeId = invoice.storeId;
    const fxFields = needsConversion ?
      {transactionCurrency: invoiceCurrency, fxRateToFunctional: fx.rate} :
      {};

    tx.set(ledgerRef.doc(), {
      date,
      account: "Accounts Receivable",
      description: `Invoice ${invoice.id}`,
      debit: total,
      credit: 0,
      storeId,
      ...fxFields,
      ...(needsConversion ? {functionalAmount: total} : {}),
    });
    tx.set(ledgerRef.doc(), {
      date,
      account: "Sales Revenue",
      description: `Invoice ${invoice.id}`,
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
        description: `Invoice ${invoice.id} tax`,
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
      description: `Invoice ${invoice.id}`,
      debit: cogs,
      credit: 0,
      storeId,
      ...fxFields,
      ...(needsConversion ? {functionalAmount: cogs} : {}),
    });
    tx.set(ledgerRef.doc(), {
      date,
      account: "Inventory",
      description: `Invoice ${invoice.id}`,
      debit: 0,
      credit: cogs,
      storeId,
      ...fxFields,
      ...(needsConversion ? {functionalAmount: cogs} : {}),
    });

    return {total};
  });

  return {success: true, amount: result.total};
});
