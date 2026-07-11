#!/usr/bin/env node
/**
 * One-time migration: move flat top-level collections into a tenant's
 * subcollections at /tenants/{tenantId}/{collection}/{docId}.
 *
 * Use this to move an existing single-tenant deployment onto the
 * multi-tenant data model without losing any data.
 *
 * Setup: same service account as manage-auth-users.mjs, plus
 *   npm install firebase-admin --no-save
 *
 * Usage:
 *   node scripts/migrate-to-tenant.mjs <tenantId> [--delete-source] [--dry-run]
 *
 * Behavior:
 *   - Creates /tenants/{tenantId} (status active, all modules) if missing
 *   - Copies every doc from each known collection into the tenant tree
 *   - Skips docs that already exist at the destination (safe to re-run)
 *   - --delete-source removes the flat docs AFTER a successful copy
 *   - --dry-run prints what would happen without writing anything
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const COLLECTIONS = [
  'invoices', 'customers', 'products', 'vendors', 'purchaseOrders', 'vendorBills',
  'rfqs', 'assets', 'itAssets', 'users', 'employees', 'stores', 'activityLogs',
  'attendance', 'leaveRequests', 'ledgerEntries', 'taxRates', 'budgets',
  'candidates', 'performanceReviews', 'billsOfMaterials', 'productionOrders',
  'qualityChecks', 'leads', 'campaigns', 'projects', 'tasks', 'tickets',
  'jobRequisitions', 'shipments', 'notifications', 'refunds', 'recurringInvoices',
  'scheduledReports', 'presence',
];

// Must match src/lib/super-admin.ts's ALL_MODULES exactly — this script's
// own copy previously drifted ('Financial Management'/'Operations' instead
// of 'Finance'/'Manufacturing'/'Project Management', and was missing
// 'Shipping & Logistics' entirely), which permanently locked tenants created
// via this script out of those modules since firestore.rules checks against
// these exact names and nothing in the app can ever grant a name outside it.
const ALL_MODULES = [
  'General', 'Sales & Customers', 'Supply Chain', 'Shipping & Logistics',
  'Manufacturing', 'Project Management', 'Finance', 'Human Resources',
  'Service Desk', 'System',
];

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccountKey.json';
if (!existsSync(KEY_PATH)) {
  console.error(`Service account key not found at ${KEY_PATH}.`);
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore();

const argv = process.argv.slice(2);
const tenantId = argv.find(a => !a.startsWith('--'));
const deleteSource = argv.includes('--delete-source');
const dryRun = argv.includes('--dry-run');

if (!tenantId || !/^[a-z0-9-]+$/.test(tenantId)) {
  console.error('Usage: node scripts/migrate-to-tenant.mjs <tenantId> [--delete-source] [--dry-run]');
  console.error('tenantId must be lowercase letters, numbers, hyphens.');
  process.exit(1);
}

async function ensureTenant() {
  const ref = db.doc(`tenants/${tenantId}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`Tenant "${tenantId}" already exists — merging data into it.`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] Would create tenant "${tenantId}" with all modules enabled.`);
    return;
  }
  await ref.set({
    id: tenantId,
    name: tenantId,
    status: 'active',
    industry: 'general',
    allowedModules: ALL_MODULES,
    enabledModules: ALL_MODULES,
    createdAt: new Date().toISOString(),
    plan: 'standard',
  });
  await db.doc(`tenantDirectory/${tenantId}`).set({ name: tenantId, status: 'active', plan: 'standard' });
  console.log(`Created tenant "${tenantId}".`);
}

async function migrateCollection(name) {
  const srcRef = db.collection(name);
  let copied = 0, skipped = 0, deleted = 0;
  let last = null;

  // Page through the source in chunks of 300 to stay well under limits
  for (;;) {
    let q = srcRef.orderBy(FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];

    const destRefs = snap.docs.map(d => db.doc(`tenants/${tenantId}/${name}/${d.id}`));
    const existing = destRefs.length ? await db.getAll(...destRefs) : [];

    const batch = db.batch();
    let ops = 0;
    snap.docs.forEach((d, i) => {
      if (existing[i]?.exists) { skipped++; return; }
      if (!dryRun) batch.set(destRefs[i], d.data());
      copied++; ops++;
    });
    if (ops > 0 && !dryRun) await batch.commit();

    if (deleteSource && !dryRun) {
      const delBatch = db.batch();
      snap.docs.forEach(d => { delBatch.delete(d.ref); deleted++; });
      await delBatch.commit();
    } else if (deleteSource) {
      deleted += snap.docs.length;
    }
    if (deleteSource) last = null; // deleted docs shift the cursor — restart
  }

  const verb = dryRun ? 'would copy' : 'copied';
  console.log(`${name.padEnd(20)} ${verb} ${copied}, skipped ${skipped}${deleteSource ? `, ${dryRun ? 'would delete' : 'deleted'} ${deleted}` : ''}`);
}

(async () => {
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Migrating flat collections → /tenants/${tenantId}/...\n`);
  await ensureTenant();
  for (const name of COLLECTIONS) {
    await migrateCollection(name);
  }
  console.log('\nDone. Next steps:');
  console.log(`  1. Assign users:   node scripts/manage-auth-users.mjs settenant <email> ${tenantId}`);
  console.log('  2. Deploy rules:   npx firebase-tools deploy --only firestore:rules');
  if (!deleteSource) console.log('  3. After verifying, re-run with --delete-source to remove the old flat data.');
})().catch(err => { console.error(err); process.exit(1); });
