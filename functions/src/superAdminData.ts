import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

const ALLOWED_COLLECTIONS = [
  "users", "ledgerEntries", "taxRates", "budgets", "vendorBills",
  "employees", "attendance", "leaveRequests", "performanceReviews",
  "candidates", "jobRequisitions", "invoices", "customers", "refunds",
  "recurringInvoices", "leads", "campaigns", "products", "vendors",
  "purchaseOrders", "rfqs", "shipments", "billsOfMaterials",
  "productionOrders", "qualityChecks", "assets", "itAssets", "projects",
  "tasks", "tickets", "stores", "activityLogs", "notifications",
  "scheduledReports", "roles", "quotations", "timesheets",
  "expenseClaims", "departments", "workflows", "apiKeys", "webhooks",
  "counters", "settings",
];

type CallerRequest = { auth?: { token?: Record<string, unknown> } };

/**
 * Throws unless the caller's token has the superAdmin claim.
 * @param {CallerRequest} request The onCall request.
 */
function requireSuperAdmin(request: CallerRequest) {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only a super admin can access cross-tenant data."
    );
  }
}

/**
 * Validates a collection name against the allowlist.
 * @param {unknown} collectionName Candidate collection name.
 * @return {string} The validated collection name.
 */
function requireValidCollection(collectionName: unknown): string {
  if (
    typeof collectionName !== "string" ||
    !ALLOWED_COLLECTIONS.includes(collectionName)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Unknown or disallowed collection."
    );
  }
  return collectionName;
}

/**
 * Validates a tenantId argument.
 * @param {unknown} tenantId Candidate tenant id.
 * @return {string} The validated tenant id.
 */
function requireTenantId(tenantId: unknown): string {
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  return tenantId;
}

type ListInput = { tenantId: string; collection: string };

export const superAdminListCollection = onCall(async (request) => {
  requireSuperAdmin(request);
  const data = (request.data ?? {}) as Partial<ListInput>;
  const tenantId = requireTenantId(data.tenantId);
  const collectionName = requireValidCollection(data.collection);

  const db = getFirestore();
  const snap = await db
    .collection("tenants").doc(tenantId).collection(collectionName)
    .limit(500)
    .get();

  return {
    docs: snap.docs.map((d) => ({id: d.id, ...d.data()})),
  };
});

type WriteInput = {
  tenantId: string;
  collection: string;
  docId?: string;
  data: Record<string, unknown>;
};

export const superAdminWriteDocument = onCall(async (request) => {
  requireSuperAdmin(request);
  const input = (request.data ?? {}) as Partial<WriteInput>;
  const tenantId = requireTenantId(input.tenantId);
  const collectionName = requireValidCollection(input.collection);
  if (!input.data || typeof input.data !== "object") {
    throw new HttpsError("invalid-argument", "data is required.");
  }

  const db = getFirestore();
  const colRef = db
    .collection("tenants").doc(tenantId).collection(collectionName);
  const docRef = input.docId ? colRef.doc(input.docId) : colRef.doc();
  await docRef.set(input.data, {merge: true});

  return {id: docRef.id};
});

type DeleteInput = { tenantId: string; collection: string; docId: string };

export const superAdminDeleteDocument = onCall(async (request) => {
  requireSuperAdmin(request);
  const input = (request.data ?? {}) as Partial<DeleteInput>;
  const tenantId = requireTenantId(input.tenantId);
  const collectionName = requireValidCollection(input.collection);
  if (!input.docId || typeof input.docId !== "string") {
    throw new HttpsError("invalid-argument", "docId is required.");
  }

  const db = getFirestore();
  await db
    .collection("tenants").doc(tenantId)
    .collection(collectionName).doc(input.docId)
    .delete();

  return {success: true};
});
