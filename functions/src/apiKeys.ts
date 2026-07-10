import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {randomBytes, createHash} from "crypto";

/**
 * Hashes a raw API key with SHA-256 for storage/comparison — never store or
 * log the raw key itself.
 * @param {string} rawKey The raw, plaintext API key.
 * @return {string} Hex-encoded SHA-256 hash.
 */
function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// Generates a new per-tenant API key, returns the raw value exactly once
// (the caller must save it — it cannot be retrieved again), and stores only
// its hash. Matches the firestore.rules apiKeys collection's admin-only
// access model.
export const generateApiKey = onCall(async (request) => {
  const tenantId = request.auth?.token?.tenantId as string | undefined;
  const role = request.auth?.token?.role as string | undefined;
  if (!tenantId || role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only a tenant admin can generate API keys."
    );
  }

  const name = (request.data?.name as string | undefined)?.trim();
  const scopes = (request.data?.scopes as string[] | undefined) ?? ["read"];
  if (!name) {
    throw new HttpsError("invalid-argument", "A key name is required.");
  }
  const validScopes = scopes.every((s) => s === "read" || s === "write");
  if (!validScopes || scopes.length === 0) {
    throw new HttpsError("invalid-argument", "Invalid scopes.");
  }

  const rawKey = `czk_${randomBytes(24).toString("hex")}`;
  const db = getFirestore();
  const ref = db.collection("tenants").doc(tenantId)
    .collection("apiKeys").doc();
  await ref.set({
    id: ref.id,
    name,
    hashedKey: hashKey(rawKey),
    keyPrefix: rawKey.slice(0, 12),
    scopes,
    createdAt: new Date().toISOString(),
    createdBy: request.auth?.uid ?? "unknown",
  });

  return {id: ref.id, rawKey};
});

export const revokeApiKey = onCall(async (request) => {
  const tenantId = request.auth?.token?.tenantId as string | undefined;
  const role = request.auth?.token?.role as string | undefined;
  if (!tenantId || role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only a tenant admin can revoke API keys."
    );
  }
  const keyId = request.data?.keyId as string | undefined;
  if (!keyId) {
    throw new HttpsError("invalid-argument", "keyId is required.");
  }
  const db = getFirestore();
  await db.collection("tenants").doc(tenantId)
    .collection("apiKeys").doc(keyId)
    .set({revokedAt: new Date().toISOString()}, {merge: true});
  return {success: true};
});

/**
 * Resolves a raw API key (from an Authorization header) to its owning tenant
 * and granted scopes, or null if the key is invalid/revoked. Scans across
 * tenants by hash — acceptable at this scale; a dedicated hash-to-tenant
 * index collection would be the next step if the tenant count grows large.
 * @param {string} rawKey The raw key presented by the caller.
 * @return {Promise<{tenantId: string, scopes: string[]} | null>} The
 * resolved tenant/scopes, or null if the key doesn't resolve.
 */
export async function resolveApiKey(
  rawKey: string
): Promise<{ tenantId: string; scopes: string[] } | null> {
  const db = getFirestore();
  const hashed = hashKey(rawKey);
  const snap = await db.collectionGroup("apiKeys")
    .where("hashedKey", "==", hashed).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.revokedAt) return null;
  const tenantId = doc.ref.parent.parent?.id;
  if (!tenantId) return null;
  await doc.ref.set(
    {lastUsedAt: new Date().toISOString()}, {merge: true}
  );
  return {tenantId, scopes: data.scopes ?? ["read"]};
}
