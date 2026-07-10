import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {createHmac} from "crypto";

const WATCHED_COLLECTIONS = [
  "invoices",
  "ledgerEntries",
  "products",
  "users",
  "roles",
  "customers",
  "vendorBills",
  "purchaseOrders",
];

/**
 * Maps a watched-collection write to a webhook event name, or undefined if
 * this particular collection/action doesn't correspond to a webhook event
 * yet. Kept to a small, deliberate set of high-value events rather than
 * firing on every mutation of every watched collection.
 * @param {string} collectionId The collection the write happened in.
 * @param {"create"|"update"|"delete"} action The kind of write.
 * @param {FirebaseFirestore.DocumentData | null} before Doc data before.
 * @param {FirebaseFirestore.DocumentData | null} after Doc data after.
 * @return {string | undefined} The webhook event name, if any.
 */
function resolveWebhookEvent(
  collectionId: string,
  action: "create" | "update" | "delete",
  before: FirebaseFirestore.DocumentData | null,
  after: FirebaseFirestore.DocumentData | null
): string | undefined {
  if (collectionId === "invoices" && action === "create") {
    return "invoice.created";
  }
  if (collectionId === "products" && action === "update") {
    const stock = after?.stock as number | undefined;
    const threshold = after?.reorderThreshold as number | undefined;
    if (typeof stock === "number" && typeof threshold === "number" &&
      stock <= threshold) {
      return "stock.low";
    }
  }
  if (collectionId === "purchaseOrders" && action === "update") {
    const wasOrdered = before?.status === "ordered";
    const nowOrdered = after?.status === "ordered";
    if (!wasOrdered && nowOrdered) {
      return "purchase-order.approved";
    }
  }
  return undefined;
}

/**
 * Dispatches a webhook event to every active endpoint subscribed to it,
 * signing the payload with each endpoint's own secret (HMAC-SHA256) so
 * receivers can verify authenticity. Fire-and-forget with a short timeout —
 * a slow/broken receiver never blocks the write that triggered it.
 * @param {string} tenantId Tenant the event belongs to.
 * @param {string} eventType The webhook event name, e.g. "invoice.created".
 * @param {unknown} payload The event payload to deliver.
 * @return {Promise<void>} Resolves once all dispatch attempts settle.
 */
async function dispatchWebhooks(
  tenantId: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  const db = getFirestore();
  const snap = await db.collection("tenants").doc(tenantId)
    .collection("webhooks")
    .where("isActive", "==", true)
    .where("events", "array-contains", eventType)
    .get();
  if (snap.empty) return;

  const body = JSON.stringify({event: eventType, tenantId, data: payload});
  await Promise.all(snap.docs.map(async (doc) => {
    const endpoint = doc.data();
    const signature = createHmac("sha256", endpoint.secret as string)
      .update(body).digest("hex");
    try {
      await fetch(endpoint.url as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CZium-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Best-effort delivery for v1 — no retry queue yet. A failed
      // delivery doesn't affect the write that triggered it.
    }
  }));
}

export const auditTrail = onDocumentWritten(
  "tenants/{tenantId}/{collectionId}/{docId}",
  async (event) => {
    const {tenantId, collectionId, docId} = event.params;
    if (!WATCHED_COLLECTIONS.includes(collectionId)) {
      return;
    }

    const before = (event.data?.before.exists ?
      event.data.before.data() : null) ?? null;
    const after = (event.data?.after.exists ?
      event.data.after.data() : null) ?? null;

    let action: "create" | "update" | "delete";
    if (!before && after) {
      action = "create";
    } else if (before && !after) {
      action = "delete";
    } else {
      action = "update";
    }

    const db = getFirestore();
    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("auditTrail")
      .add({
        collection: collectionId,
        docId,
        action,
        before,
        after,
        at: FieldValue.serverTimestamp(),
      });

    const eventType = resolveWebhookEvent(collectionId, action, before, after);
    if (eventType) {
      await dispatchWebhooks(tenantId, eventType, after);
    }
  }
);
