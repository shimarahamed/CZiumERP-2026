import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

const VALID_ROLES = ["admin", "manager", "cashier", "inventory-staff"];

type SetUserClaimsInput = {
  uid: string;
  superAdmin?: boolean;
  tenantId?: string;
  role?: string;
};

export const setUserClaims = onCall(async (request) => {
  const callerToken = request.auth?.token;
  if (!callerToken?.superAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only a super admin can change user claims."
    );
  }

  const {uid, superAdmin, tenantId, role} =
    (request.data ?? {}) as Partial<SetUserClaimsInput>;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  const auth = getAuth();
  const db = getFirestore();

  let newClaims: Record<string, unknown>;
  if (superAdmin) {
    newClaims = {superAdmin: true, role: "admin"};
  } else {
    if (!tenantId || typeof tenantId !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "tenantId is required when granting a tenant role."
      );
    }
    if (!role || !VALID_ROLES.includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid role.");
    }
    newClaims = {tenantId, role};
  }

  await auth.setCustomUserClaims(uid, newClaims);
  await auth.revokeRefreshTokens(uid);

  const superAdminRef = db.collection("superAdmins").doc(uid);
  if (superAdmin) {
    const user = await auth.getUser(uid);
    await superAdminRef.set({
      email: user.email ?? null,
      grantedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await superAdminRef.delete().catch(() => undefined);
  }

  return {uid, claims: newClaims};
});
