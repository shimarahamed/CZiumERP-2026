import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const postingFunction = readFileSync(
  path.join(process.cwd(), 'functions/src/postInvoiceWithLedger.ts'),
  'utf8'
);
// The transaction body lives in the shared core, used by both the callable
// and the postQueuedInvoice trigger (POS offline outbox).
const postingCore = readFileSync(
  path.join(process.cwd(), 'functions/src/postInvoiceCore.ts'),
  'utf8'
);
const queuedTrigger = readFileSync(
  path.join(process.cwd(), 'functions/src/postQueuedInvoice.ts'),
  'utf8'
);
const postingClient = readFileSync(
  path.join(process.cwd(), 'src/lib/posting.ts'),
  'utf8'
);

describe('invoice posting invariants', () => {
  it('posts invoices through one backend transaction with the correct sales gate', () => {
    expect(postingCore).toContain('db.runTransaction');
    expect(postingCore).toContain('enabledModules.includes("Sales & Customers")');
    expect(postingCore).toContain('const financeEnabled = enabledModules.includes("Finance")');
    expect(postingCore).toContain('if (financeEnabled) {');
    expect(postingCore).not.toContain('"Finance module is not enabled."');
    expect(postingCore).not.toContain('Financial Management');
  });

  it('routes both posting entry points through the shared core', () => {
    expect(postingFunction).toContain('runInvoicePosting');
    expect(queuedTrigger).toContain('runInvoicePosting');
    // The queued trigger must only ever act on client-queued POS sales and
    // never lose one: failures are recorded on the doc, not swallowed.
    expect(queuedTrigger).toContain('data.postStatus !== "queued"');
    expect(queuedTrigger).toContain('postStatus: "failed"');
  });

  it('allocates invoice numbers and inventory consumption server-side', () => {
    expect(postingFunction).toContain('payload.invoicePrefix');
    expect(postingCore).toContain('collection("counters").doc("invoice")');
    expect(postingCore).toContain('const sellableItems = invoice.items.filter((item) => !item.isCustom)');
    expect(postingCore).toContain('product.serviceLinks');
    expect(postingCore).toContain('collection("stockLevels")');
    expect(postingCore).toContain('collection("lots")');
    expect(postingCore).toContain('collection("serialUnits")');
    expect(postingCore).not.toContain('Insufficient lot stock');
  });

  it('keeps invoice posting close to Firestore and warm by default', () => {
    expect(postingFunction).toContain('const POSTING_REGION = "asia-south1"');
    expect(postingFunction).toContain('region: POSTING_REGION');
    expect(postingFunction).toContain('process.env.POSTING_MIN_INSTANCES ?? 1');
    expect(postingClient).toContain("const POSTING_REGION = 'asia-south1'");
    expect(postingClient).toContain('getFunctions(app, POSTING_REGION)');
  });
});
