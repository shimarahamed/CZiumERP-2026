import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

type ResetUserPasswordInput = { uid: string; newPassword: string };

/**
 * Lets a tenant admin reset the password of another user in their own
 * tenant. Scoped by tenantId so an admin can never touch another tenant's
 * accounts (only superAdminSetUserPassword can cross tenants).
 */
export const resetTenantUserPassword = onCall(async (request) => {
  const callerToken = request.auth?.token;
  const callerTenantId = callerToken?.tenantId as string | undefined;
  const callerRole = callerToken?.role as string | undefined;
  if (!callerTenantId || callerRole !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only a tenant admin can reset a user's password."
    );
  }

  const {uid, newPassword} =
    (request.data ?? {}) as Partial<ResetUserPasswordInput>;
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

  const db = getFirestore();
  const targetDoc = await db
    .collection("tenants").doc(callerTenantId).collection("users").doc(uid)
    .get();
  if (!targetDoc.exists) {
    throw new HttpsError(
      "permission-denied",
      "That user does not belong to your tenant."
    );
  }

  const auth = getAuth();
  await auth.updateUser(uid, {password: newPassword});
  await auth.revokeRefreshTokens(uid);

  return {success: true};
});
