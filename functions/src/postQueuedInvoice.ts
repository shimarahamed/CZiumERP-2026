import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {runInvoicePosting, PostingError, type Invoice} from "./postInvoiceCore";

/**
 * Outbox consumer for POS sales. The POS client writes the sale as a
 * provisional invoice doc with postStatus "queued" (a plain Firestore write,
 * so it works offline and syncs whenever the device reconnects). This
 * trigger then performs the authoritative posting — stock decrement, invoice
 * numbering, totals, GL entries — in one transaction that also deletes the
 * provisional doc and creates the final numbered invoice carrying the same
 * clientRef, which is how the client reconciles its receipt view.
 *
 * Failures (e.g. insufficient stock discovered at sync time) mark the queued
 * doc postStatus "failed" with the reason, instead of losing the sale.
 */
export const postQueuedInvoice = onDocumentCreated(
  "tenants/{tenantId}/invoices/{invoiceId}",
  async (event) => {
    const data = event.data?.data();
    // Only client-queued POS sales; ignore every other invoice write
    // (invoices page, callable-posted docs, this trigger's own output).
    if (!data || data.postStatus !== "queued") return;

    const {tenantId, invoiceId} = event.params;
    const db = getFirestore();
    const queuedDocRef = db
      .collection("tenants").doc(tenantId)
      .collection("invoices").doc(invoiceId);

    const invoicePrefix =
      typeof data.invoicePrefix === "string" && data.invoicePrefix ?
        data.invoicePrefix :
        "INV-";

    // Strip outbox bookkeeping; clear id so the counter allocates the final
    // number (the provisional doc id is a client-generated reference). The
    // client's predicted number is passed along as a request so the number
    // already shown on its receipt is kept whenever it is still free.
    const invoice = {...data, id: ""} as Invoice;
    const predictedId = invoice.predictedId;
    delete invoice.postStatus;
    delete invoice.postError;
    delete invoice.invoicePrefix;
    delete invoice.predictedId;

    const requestedNumber = predictedId?.startsWith(invoicePrefix) ?
      Number(predictedId.slice(invoicePrefix.length)) :
      undefined;

    try {
      await runInvoicePosting({
        db,
        tenantId,
        invoice,
        invoicePrefix,
        actor: invoice.userName ?? "pos-sync",
        queuedDocRef,
        requestedNumber: Number.isFinite(requestedNumber) ?
          requestedNumber :
          undefined,
        extraInvoiceFields: {
          postStatus: "posted",
          postedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof PostingError ?
        err.message :
        "Posting failed unexpectedly. Contact support.";
      if (!(err instanceof PostingError)) {
        console.error(`postQueuedInvoice ${tenantId}/${invoiceId} failed`, err);
      }
      // Keep the sale — surface the failure on the queued doc for review.
      await queuedDocRef
        .set({postStatus: "failed", postError: message}, {merge: true})
        .catch((updateErr) => {
          console.error(
            `postQueuedInvoice ${tenantId}/${invoiceId}: ` +
              "could not record failure",
            updateErr
          );
        });
    }
  }
);
