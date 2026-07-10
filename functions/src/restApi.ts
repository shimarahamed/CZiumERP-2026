import {onRequest} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {resolveApiKey} from "./apiKeys";

// Collections a v1 API key can read. Kept to a small, deliberate allowlist —
// read endpoints an external integrator (Zapier, a script, another internal
// tool) would realistically need first. Extend this list as real use cases
// come up rather than exposing every tenant subcollection by default.
const READABLE_COLLECTIONS = new Set([
  "products",
  "invoices",
  "customers",
  "vendors",
  "purchaseOrders",
  "stockLevels",
  "warehouses",
]);

const MAX_PAGE_SIZE = 200;

export const restApi = onRequest(async (req, res) => {
  res.set("Content-Type", "application/json");

  const authHeader = req.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    res.status(401).json({error: "Missing or malformed Authorization header."});
    return;
  }

  const resolved = await resolveApiKey(match[1]);
  if (!resolved) {
    res.status(401).json({error: "Invalid or revoked API key."});
    return;
  }

  // Path shape: /v1/{collection} — everything else is unsupported for now.
  const segments = req.path.split("/").filter(Boolean);
  const [version, collectionName] = segments;
  if (version !== "v1" || !collectionName) {
    res.status(404).json({error: "Not found. Try /v1/{collection}."});
    return;
  }
  if (!READABLE_COLLECTIONS.has(collectionName)) {
    res.status(404).json({
      error: `Unknown or unsupported collection: ${collectionName}.`,
    });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({error: "Only GET is supported in this version."});
    return;
  }

  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ?
    Math.min(limitParam, MAX_PAGE_SIZE) :
    50;

  const db = getFirestore();
  const snap = await db.collection("tenants").doc(resolved.tenantId)
    .collection(collectionName)
    .limit(limit)
    .get();

  res.status(200).json({
    data: snap.docs.map((d) => d.data()),
    count: snap.size,
  });
});
