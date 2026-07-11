import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {runInvoicePosting, PostingError, type Invoice} from "./postInvoiceCore";

const POSTING_REGION = "asia-south1";
const POSTING_MIN_INSTANCES = Number(process.env.POSTING_MIN_INSTANCES ?? 1);

export const postInvoiceWithLedger = onCall({
  region: POSTING_REGION,
  timeoutSeconds: 30,
  memory: "512MiB",
  minInstances: POSTING_MIN_INSTANCES,
}, async (request) => {
  const callerToken = request.auth?.token;
  if (!callerToken) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }

  const tenantId = callerToken.tenantId as string | undefined;
  const callerRole = callerToken.role as string | undefined;
  const validRoles = ["admin", "manager", "cashier", "inventory-staff"];
  if (!tenantId || !callerRole || !validRoles.includes(callerRole)) {
    throw new HttpsError(
      "permission-denied",
      "Not authorized to post invoices."
    );
  }

  const payload = request.data ?? {};
  const invoice = payload.invoice as Invoice | undefined;
  const invoicePrefix =
    typeof payload.invoicePrefix === "string" && payload.invoicePrefix ?
      payload.invoicePrefix :
      "INV-";
  const hasItems = invoice && Array.isArray(invoice.items) &&
    invoice.items.length > 0;
  if (!hasItems || !invoice) {
    throw new HttpsError(
      "invalid-argument",
      "Invoice with at least one item is required."
    );
  }

  try {
    const result = await runInvoicePosting({
      db: getFirestore(),
      tenantId,
      invoice,
      invoicePrefix,
      actor: (callerToken.email as string | undefined) ?? "system",
    });
    if (!result) {
      throw new HttpsError("internal", "Posting produced no result.");
    }
    return {success: true, amount: result.total, invoice: result.invoice};
  } catch (err) {
    if (err instanceof PostingError) {
      throw new HttpsError(err.code, err.message);
    }
    throw err;
  }
});
