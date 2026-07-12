import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

type BackupType =
  | "scheduled"
  | "manual"
  | "uploaded"
  | "pre-restore-snapshot";

type BackupMeta = {
  id: string;
  status: "in_progress" | "complete" | "failed";
  createdAt: string;
  createdBy: string;
  type: BackupType;
  sizeBytes?: number;
  collectionCounts?: Record<string, number>;
  storagePath?: string;
  error?: string;
};

type BackupPayload = {
  tenantId: string;
  exportedAt: string;
  collections: Record<
    string, { id: string; data: FirebaseFirestore.DocumentData }[]
  >;
};

/**
 * Exports every subcollection of a tenant (except the backups log itself)
 * into a single JSON file in Cloud Storage, and records the run in the
 * tenant's backups metadata collection. Collections are discovered
 * dynamically via listCollections() so new modules are backed up without
 * code changes here.
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {string} tenantId Tenant to back up.
 * @param {BackupType} type What triggered this backup.
 * @param {string} createdBy uid of the caller, or "system" for the
 * scheduled job.
 * @return {Promise<BackupMeta>} The resulting metadata record.
 */
async function backupTenant(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  type: BackupType,
  createdBy: string
): Promise<BackupMeta> {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const backupRef = tenantRef.collection("backups").doc();
  const createdAt = new Date().toISOString();

  let meta: BackupMeta = {
    id: backupRef.id,
    status: "in_progress",
    createdAt,
    createdBy,
    type,
  };
  await backupRef.set(meta);

  try {
    const collections = await tenantRef.listCollections();
    const payload: BackupPayload["collections"] = {};
    const counts: Record<string, number> = {};

    for (const coll of collections) {
      if (coll.id === "backups") continue;
      const snap = await coll.get();
      payload[coll.id] = snap.docs.map((d) => ({id: d.id, data: d.data()}));
      counts[coll.id] = snap.size;
    }

    const body: BackupPayload = {
      tenantId, exportedAt: createdAt, collections: payload,
    };
    const json = JSON.stringify(body);
    const storagePath = `tenants/${tenantId}/backups/${backupRef.id}.json`;
    const file = getStorage().bucket().file(storagePath);
    await file.save(json, {contentType: "application/json"});

    meta = {
      ...meta,
      status: "complete",
      sizeBytes: Buffer.byteLength(json),
      collectionCounts: counts,
      storagePath,
    };
    await backupRef.set(meta, {merge: true});
    return meta;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    meta = {...meta, status: "failed", error: message};
    await backupRef.set(meta, {merge: true});
    throw err;
  }
}

/**
 * Deletes every document in a collection in batches.
 * @param {FirebaseFirestore.Firestore} db Firestore instance.
 * @param {FirebaseFirestore.CollectionReference} collRef Collection to clear.
 * @param {number} batchSize Max deletes per batch commit.
 * @return {Promise<void>} Resolves once the collection is empty.
 */
async function clearCollection(
  db: FirebaseFirestore.Firestore,
  collRef: FirebaseFirestore.CollectionReference,
  batchSize = 300
): Promise<void> {
  for (;;) {
    const snap = await collRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) break;
  }
}

type CallerRequest = {
  auth?: { uid?: string; token?: Record<string, unknown> };
};

/**
 * Resolves whether the caller may act on the given tenant as either its own
 * tenant admin or a super admin, and returns the caller's uid for
 * attribution. Throws if neither condition holds.
 * @param {CallerRequest} request The onCall request.
 * @param {string} tenantId The tenant being acted on.
 * @return {string} The caller's uid, or "unknown" if absent.
 */
function requireTenantAdminOrSuperAdmin(
  request: CallerRequest,
  tenantId: string
): string {
  const token = request.auth?.token;
  const isSuperAdmin = token?.superAdmin === true;
  const isOwnTenantAdmin =
    token?.tenantId === tenantId && token?.role === "admin";
  if (!isSuperAdmin && !isOwnTenantAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only that tenant's admin or a super admin can do this."
    );
  }
  return request.auth?.uid ?? "unknown";
}

/**
 * Runs a backup for every active tenant. Scheduled daily at 02:00.
 * @return {Promise<void>} Resolves once all tenants are processed.
 */
async function runAllTenantBackups(): Promise<void> {
  const db = getFirestore();
  const tenantsSnap = await db.collection("tenants")
    .where("status", "==", "active").get();
  for (const tenantDoc of tenantsSnap.docs) {
    try {
      await backupTenant(db, tenantDoc.id, "scheduled", "system");
    } catch {
      // Failure is already recorded on the backup doc itself; continue so
      // one tenant's failure doesn't block the rest of the run.
    }
  }
}

export const runScheduledBackups = onSchedule("every day 02:00", async () => {
  await runAllTenantBackups();
});

export const triggerTenantBackup = onCall(async (request) => {
  const tenantId = request.data?.tenantId as string | undefined;
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  const uid = requireTenantAdminOrSuperAdmin(request, tenantId);
  const db = getFirestore();
  const meta = await backupTenant(db, tenantId, "manual", uid);
  return {success: true, backup: meta};
});

export const downloadTenantBackup = onCall(async (request) => {
  const tenantId = request.data?.tenantId as string | undefined;
  const backupId = request.data?.backupId as string | undefined;
  if (!tenantId || !backupId) {
    throw new HttpsError(
      "invalid-argument",
      "tenantId and backupId are required."
    );
  }
  requireTenantAdminOrSuperAdmin(request, tenantId);

  const db = getFirestore();
  const backupDoc = await db.collection("tenants").doc(tenantId)
    .collection("backups").doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }
  const storagePath = backupDoc.data()?.storagePath as string | undefined;
  if (!storagePath) {
    throw new HttpsError("failed-precondition", "Backup has no file yet.");
  }

  // Returned inline rather than via a signed URL: signing requires the
  // functions service account to have iam.serviceAccounts.signBlob on
  // itself, which isn't granted by default. Backups are small JSON exports
  // well under the callable response size limit, so streaming the content
  // directly avoids the extra IAM setup.
  const [contents] = await getStorage().bucket().file(storagePath).download();
  return {json: contents.toString("utf8")};
});

export const uploadTenantBackup = onCall(async (request) => {
  const tenantId = request.data?.tenantId as string | undefined;
  const json = request.data?.json as string | undefined;
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  if (!json || typeof json !== "string") {
    throw new HttpsError("invalid-argument", "json is required.");
  }
  const uid = requireTenantAdminOrSuperAdmin(request, tenantId);

  let parsed: BackupPayload;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new HttpsError("invalid-argument", "json is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" ||
      typeof parsed.collections !== "object") {
    throw new HttpsError(
      "invalid-argument",
      "File does not look like a tenant backup."
    );
  }

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const backupRef = tenantRef.collection("backups").doc();
  const createdAt = new Date().toISOString();
  const storagePath = `tenants/${tenantId}/backups/${backupRef.id}.json`;
  const file = getStorage().bucket().file(storagePath);
  await file.save(json, {contentType: "application/json"});

  const counts: Record<string, number> = {};
  for (const [collName, docs] of Object.entries(parsed.collections)) {
    counts[collName] = Array.isArray(docs) ? docs.length : 0;
  }

  const meta: BackupMeta = {
    id: backupRef.id,
    status: "complete",
    createdAt,
    createdBy: uid,
    type: "uploaded",
    sizeBytes: Buffer.byteLength(json),
    collectionCounts: counts,
    storagePath,
  };
  await backupRef.set(meta);
  return {success: true, backup: meta};
});

type RestoreInput = { tenantId: string; backupId: string; confirm: string };

export const restoreTenantBackup = onCall(async (request) => {
  const input = (request.data ?? {}) as Partial<RestoreInput>;
  const tenantId = input.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  const uid = requireTenantAdminOrSuperAdmin(request, tenantId);
  if (!input.backupId || typeof input.backupId !== "string") {
    throw new HttpsError("invalid-argument", "backupId is required.");
  }
  if (input.confirm !== tenantId) {
    throw new HttpsError(
      "invalid-argument",
      "Confirmation text must exactly match the tenant id."
    );
  }

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const backupDoc = await tenantRef.collection("backups")
    .doc(input.backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }
  const storagePath = backupDoc.data()?.storagePath as string | undefined;
  if (!storagePath) {
    throw new HttpsError("failed-precondition", "Backup has no file yet.");
  }

  // Always snapshot current state first, so a bad restore is itself
  // undoable — the whole point of this feature is to never again lose
  // data to an irreversible action.
  await backupTenant(db, tenantId, "pre-restore-snapshot", uid);

  const [contents] = await getStorage().bucket().file(storagePath).download();
  const parsed = JSON.parse(contents.toString("utf8")) as BackupPayload;

  const restoredCounts: Record<string, number> = {};
  for (const [collName, docs] of Object.entries(parsed.collections)) {
    if (collName === "backups") continue;
    const collRef = tenantRef.collection(collName);
    await clearCollection(db, collRef);
    const items = Array.isArray(docs) ? docs : [];
    for (let i = 0; i < items.length; i += 300) {
      const batch = db.batch();
      for (const {id, data} of items.slice(i, i + 300)) {
        batch.set(collRef.doc(id), data);
      }
      await batch.commit();
    }
    restoredCounts[collName] = items.length;
  }

  return {success: true, restoredCounts};
});
