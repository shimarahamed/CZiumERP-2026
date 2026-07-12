import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

// Each scope is an independent "reset this domain" action. Collections and
// counters are grouped by the real-world record they belong to — e.g.
// resetting invoices also clears the ledger entries and stock movement
// records an invoice posting produces, since those have no meaning without
// the invoice that created them. Users and tenant configuration/settings
// are deliberately never included in any scope.
const RESET_SCOPES = {
  invoices: {
    collections: [
      "invoices", "ledgerEntries", "stockLevels",
      "lots", "serialUnits", "reportRollups",
    ],
    counters: ["invoice"],
  },
  purchaseOrders: {
    collections: ["purchaseOrders", "rfqs", "vendorBills"],
    counters: ["purchaseOrder"],
  },
  refunds: {
    collections: ["refunds"],
    counters: ["refund"],
  },
  products: {
    collections: ["products", "productCategories"],
    counters: [],
  },
  customers: {
    collections: ["customers"],
    counters: [],
  },
  vendors: {
    collections: ["vendors"],
    counters: [],
  },
} as const;

type ResetScope = keyof typeof RESET_SCOPES;

/**
 * Narrows an unknown value to a valid reset scope key.
 * @param {unknown} value Candidate scope value.
 * @return {boolean} Whether value is a key of RESET_SCOPES.
 */
function isResetScope(value: unknown): value is ResetScope {
  return typeof value === "string" && value in RESET_SCOPES;
}

type CallerRequest = { auth?: { token?: Record<string, unknown> } };

/**
 * Throws unless the caller's token has the superAdmin claim.
 * @param {CallerRequest} request The onCall request.
 */
function requireSuperAdmin(request: CallerRequest): void {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only a super admin can reset tenant data."
    );
  }
}

/**
 * Deletes every document in a collection in batches.
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {FirebaseFirestore.CollectionReference} collRef Collection to clear.
 * @param {number} batchSize Max deletes per batch commit.
 * @return {Promise<number>} Number of documents deleted.
 */
async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collRef: FirebaseFirestore.CollectionReference,
  batchSize = 300
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await collRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

type ResetInput = { tenantId: string; scope: string; confirm: string };

/**
 * Wipes one domain of a tenant's data (invoices, purchase orders, refunds,
 * products, customers, or vendors — and, for invoices/purchase orders, the
 * records that only exist because of them, like ledger entries and stock
 * movement) and resets any document-numbering counter tied to that domain
 * back to zero. Users and tenant configuration/settings are never touched
 * by any scope.
 *
 * Super-admin only. Requires the caller to type the tenant id as a
 * confirmation string to guard against accidental use.
 */
export const resetTenantData = onCall(async (request) => {
  requireSuperAdmin(request);
  const input = (request.data ?? {}) as Partial<ResetInput>;
  const tenantId = input.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  if (!isResetScope(input.scope)) {
    throw new HttpsError(
      "invalid-argument",
      `scope must be one of: ${Object.keys(RESET_SCOPES).join(", ")}.`
    );
  }
  if (input.confirm !== tenantId) {
    throw new HttpsError(
      "invalid-argument",
      "Confirmation text must exactly match the tenant id."
    );
  }

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant not found.");
  }

  const {collections, counters} = RESET_SCOPES[input.scope];
  const deletedCounts: Record<string, number> = {};
  for (const collectionName of collections) {
    deletedCounts[collectionName] = await deleteCollection(
      db,
      tenantRef.collection(collectionName)
    );
  }

  if (counters.length > 0) {
    const countersBatch = db.batch();
    for (const counterType of counters) {
      countersBatch.set(
        tenantRef.collection("counters").doc(counterType),
        {value: 0},
        {merge: false}
      );
    }
    await countersBatch.commit();
  }

  return {success: true, scope: input.scope, deletedCounts};
});
