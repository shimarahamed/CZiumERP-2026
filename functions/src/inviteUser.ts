import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const VALID_ROLES = ["admin", "manager", "cashier", "inventory-staff"];

type InviteUserInput = {
  email: string;
  password: string;
  role: string;
  name: string;
  storeId?: string;
};

export const inviteUser = onCall(async (request) => {
  const callerToken = request.auth?.token;
  if (!callerToken) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }

  const tenantId = callerToken.tenantId as string | undefined;
  const callerRole = callerToken.role as string | undefined;
  if (!tenantId || callerRole !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only a tenant admin can invite users."
    );
  }

  const {email, password, role, name, storeId} =
    (request.data ?? {}) as Partial<InviteUserInput>;
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters."
    );
  }
  if (!role || !VALID_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }
  if (!name || typeof name !== "string") {
    throw new HttpsError("invalid-argument", "Name is required.");
  }

  const db = getFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists || tenantSnap.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "Tenant is not active.");
  }

  const auth = getAuth();
  let uid: string;
  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
    uid = userRecord.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "";
    if (code.includes("already-exists")) {
      throw new HttpsError(
        "already-exists",
        "An account with this email already exists."
      );
    }
    throw new HttpsError("internal", "Could not create the account.");
  }

  await auth.setCustomUserClaims(uid, {role, tenantId});

  const userRef = db
    .collection("tenants").doc(tenantId).collection("users").doc(uid);
  await userRef.set({
    id: uid,
    name,
    email,
    avatar: "",
    role,
    ...(storeId ? {storeId} : {}),
  });

  return {uid};
});
