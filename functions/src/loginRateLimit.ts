import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type LoginRateLimitInput = {
  email: string;
  success: boolean;
};

export const loginRateLimit = onCall(async (request) => {
  const {email, success} = (request.data ?? {}) as Partial<LoginRateLimitInput>;
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const db = getFirestore();
  const docId = email.trim().toLowerCase();
  const ref = db.collection("loginAttempts").doc(docId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    const data = snap.exists ? snap.data() ?? null : null;

    const lockedUntil = data?.lockedUntil as Timestamp | undefined;
    if (lockedUntil && lockedUntil.toMillis() > now.toMillis()) {
      return {allowed: false, lockedUntil: lockedUntil.toMillis()};
    }

    if (success) {
      tx.set(ref, {
        count: 0,
        lastAttemptAt: now,
        lockedUntil: FieldValue.delete(),
      }, {merge: true});
      return {allowed: true};
    }

    const firstAttemptAt = data?.firstAttemptAt as Timestamp | undefined;
    const withinWindow = firstAttemptAt &&
      now.toMillis() - firstAttemptAt.toMillis() < WINDOW_MS;
    const count = (withinWindow ? (data?.count as number) ?? 0 : 0) + 1;

    const update: Record<string, unknown> = {
      count,
      lastAttemptAt: now,
      firstAttemptAt: withinWindow ? firstAttemptAt : now,
    };

    if (count >= MAX_ATTEMPTS) {
      update.lockedUntil = Timestamp.fromMillis(now.toMillis() + LOCKOUT_MS);
    }

    tx.set(ref, update, {merge: true});
    return {allowed: count < MAX_ATTEMPTS};
  });

  if (!result.allowed) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many failed login attempts. Try again later."
    );
  }

  return {allowed: true};
});
