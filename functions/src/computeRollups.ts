import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {addMoney, mulMoney} from "./money";

type InvoiceItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
};

type InvoiceDoc = {
  id: string;
  status: string;
  date: string; // YYYY-MM-DD
  storeId?: string;
  customerId?: string;
  amount: number;
  items?: InvoiceItem[];
};

type TopProduct = {
  productId: string;
  productName: string;
  revenue: number;
  units: number;
};

/**
 * Computes one day's rollup (tenant-wide and per-store) from that tenant's
 * paid invoices dated `dateStr`. A customer counts as "new" for the day if
 * this is chronologically their first paid invoice — derived purely from
 * invoice history since Customer has no createdAt field to read instead.
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {string} tenantId Tenant to compute for.
 * @param {string} dateStr Date to roll up, YYYY-MM-DD.
 * @return {Promise<void>} Resolves once all rollup docs are written.
 */
async function computeDayForTenant(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  dateStr: string
): Promise<void> {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const invoicesSnap = await tenantRef.collection("invoices")
    .where("date", "==", dateStr)
    .where("status", "==", "paid")
    .get();
  if (invoicesSnap.empty) return;

  const dayInvoices = invoicesSnap.docs.map(
    (d) => ({id: d.id, ...d.data()} as InvoiceDoc)
  );

  // Determine which customers on this day's invoices are new: look up each
  // customer's earliest paid invoice date across the whole tenant history.
  const customerIds = [...new Set(
    dayInvoices.map((i) => i.customerId).filter((c): c is string => !!c)
  )];
  const newCustomerIds = new Set<string>();
  for (const customerId of customerIds) {
    const earliestSnap = await tenantRef.collection("invoices")
      .where("customerId", "==", customerId)
      .where("status", "==", "paid")
      .orderBy("date", "asc")
      .limit(1)
      .get();
    if (earliestSnap.docs[0]?.data().date === dateStr) {
      newCustomerIds.add(customerId);
    }
  }

  const groups = new Map<string | undefined, InvoiceDoc[]>();
  groups.set(undefined, dayInvoices); // tenant-wide
  for (const inv of dayInvoices) {
    const key = inv.storeId;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), inv]);
  }

  const batch = db.batch();
  for (const [storeId, invoices] of groups) {
    const revenue = addMoney(...invoices.map((i) => i.amount), 0);
    const cogs = addMoney(
      ...invoices.flatMap((i) => (i.items ?? []).map(
        (item) => mulMoney(item.cost, item.quantity)
      )),
      0
    );
    const productMap = new Map<string, TopProduct>();
    for (const inv of invoices) {
      for (const item of inv.items ?? []) {
        const cur = productMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          revenue: 0,
          units: 0,
        };
        const lineRevenue = mulMoney(item.price, item.quantity);
        cur.revenue = addMoney(cur.revenue, lineRevenue);
        cur.units += item.quantity;
        productMap.set(item.productId, cur);
      }
    }
    const topProducts = [...productMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const newCustomerCount = storeId === undefined ?
      newCustomerIds.size :
      invoices.filter((i) => i.customerId && newCustomerIds.has(i.customerId))
        .length;

    const id = `${storeId ?? "all"}_${dateStr}`;
    batch.set(tenantRef.collection("reportRollups").doc(id), {
      id,
      date: dateStr,
      storeId: storeId ?? null,
      revenue,
      cogs,
      grossMargin: addMoney(revenue, -cogs),
      invoiceCount: invoices.length,
      newCustomerCount,
      topProducts,
      computedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

/**
 * Rolls up yesterday's invoices for every active tenant. Runs once daily;
 * safe to re-run (idempotent — each day's doc is fully overwritten).
 * @return {Promise<void>} Resolves once every tenant has been processed.
 */
async function runDailyRollup(): Promise<void> {
  const db = getFirestore();
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString().slice(0, 10);
  const tenantsSnap = await db.collection("tenants")
    .where("status", "==", "active").get();
  for (const tenantDoc of tenantsSnap.docs) {
    await computeDayForTenant(db, tenantDoc.id, yesterday);
  }
}

export const computeRollups = onSchedule("every day 01:00", async () => {
  await runDailyRollup();
});

// Callable for backfilling or on-demand recomputation from Settings/testing,
// rather than waiting for the next scheduled run.
export const computeRollupsNow = onCall(async (request) => {
  const tenantId = request.auth?.token?.tenantId as string | undefined;
  const isSuperAdmin = request.auth?.token?.superAdmin === true;
  if (!tenantId && !isSuperAdmin) {
    throw new Error("Sign-in required.");
  }
  const dateStr = (request.data?.date as string | undefined) ??
    new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const db = getFirestore();
  if (tenantId) {
    await computeDayForTenant(db, tenantId, dateStr);
  } else {
    await runDailyRollup();
  }
  return {success: true};
});
