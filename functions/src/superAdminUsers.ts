import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

type CallerRequest = { auth?: { token?: Record<string, unknown> } };

/**
 * Throws unless the caller's token has the superAdmin claim.
 * @param {CallerRequest} request The onCall request.
 */
function requireSuperAdmin(request: CallerRequest) {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only a super admin can perform this action."
    );
  }
}

type ListTenantUsersInput = { tenantId: string };

export const superAdminListTenantUsers = onCall(async (request) => {
  requireSuperAdmin(request);
  const {tenantId} = (request.data ?? {}) as Partial<ListTenantUsersInput>;
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }

  const db = getFirestore();
  const snap = await db
    .collection("tenants").doc(tenantId).collection("users")
    .get();

  return {
    users: snap.docs.map((d) => ({id: d.id, ...d.data()})),
  };
});

type SetPasswordInput = { uid: string; newPassword: string };

export const superAdminSetUserPassword = onCall(async (request) => {
  requireSuperAdmin(request);
  const {uid, newPassword} =
    (request.data ?? {}) as Partial<SetPasswordInput>;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  const hasValidLength =
    typeof newPassword === "string" && newPassword.length >= 8;
  if (!newPassword || !hasValidLength) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters."
    );
  }

  const auth = getAuth();
  await auth.updateUser(uid, {password: newPassword});
  await auth.revokeRefreshTokens(uid);

  return {success: true};
});
