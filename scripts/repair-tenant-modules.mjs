#!/usr/bin/env node
/**
 * One-time repair: fixes tenants whose allowedModules/enabledModules were
 * written with stale module names ('Financial Management', 'Operations')
 * that predate the real module list in src/lib/super-admin.ts, and/or are
 * missing modules added since (e.g. 'Shipping & Logistics', which merges
 * into 'Manufacturing'/'Finance'... wait — see RENAME_MAP below).
 *
 * firestore.rules' moduleEnabled() checks tenant.enabledModules for the
 * EXACT current module name. A stale name there is not just cosmetic — it
 * permanently denies that module's collections for the tenant, since no
 * client-side toggle can ever write a name the app itself doesn't know
 * about, and the security rule never matches it either.
 *
 * Setup: same as scripts/manage-auth-users.mjs (serviceAccountKey.json).
 *
 * Usage:
 *   node scripts/repair-tenant-modules.mjs <tenantId> [--dry-run]
 *   node scripts/repair-tenant-modules.mjs --all [--dry-run]
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ALL_MODULES = [
  'General', 'Sales & Customers', 'Supply Chain', 'Shipping & Logistics',
  'Manufacturing', 'Project Management', 'Finance', 'Human Resources',
  'Service Desk', 'System',
];

// Old name -> current name. 'Operations' used to cover both Manufacturing
// AND Project Management collections in firestore.rules, so on repair we
// expand it into both rather than guessing which one was intended.
const RENAME_MAP = {
  'Financial Management': ['Finance'],
  'Operations': ['Manufacturing', 'Project Management'],
};

function repairList(list) {
  const out = new Set();
  for (const m of list ?? []) {
    if (ALL_MODULES.includes(m)) {
      out.add(m);
    } else if (RENAME_MAP[m]) {
      RENAME_MAP[m].forEach(x => out.add(x));
    }
    // anything else (unrecognized junk) is dropped
  }
  return [...out];
}

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccountKey.json';
if (!existsSync(KEY_PATH)) {
  console.error(`Service account key not found at ${KEY_PATH}.`);
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const all = argv.includes('--all');
const tenantId = argv.find(a => !a.startsWith('--'));

async function repairTenant(id, data) {
  const oldAllowed = data.allowedModules ?? [];
  const oldEnabled = data.enabledModules ?? [];
  const newAllowed = repairList(oldAllowed);
  const newEnabled = repairList(oldEnabled).filter(m => newAllowed.includes(m));

  const allowedChanged = JSON.stringify([...oldAllowed].sort()) !== JSON.stringify([...newAllowed].sort());
  const enabledChanged = JSON.stringify([...oldEnabled].sort()) !== JSON.stringify([...newEnabled].sort());

  if (!allowedChanged && !enabledChanged) {
    console.log(`  ${id}: already clean, no change.`);
    return;
  }

  console.log(`  ${id}:`);
  if (allowedChanged) console.log(`    allowedModules: ${JSON.stringify(oldAllowed)} -> ${JSON.stringify(newAllowed)}`);
  if (enabledChanged) console.log(`    enabledModules: ${JSON.stringify(oldEnabled)} -> ${JSON.stringify(newEnabled)}`);

  if (dryRun) {
    console.log('    [dry-run] no write performed.');
    return;
  }
  await db.doc(`tenants/${id}`).update({ allowedModules: newAllowed, enabledModules: newEnabled });
  console.log('    written.');
}

async function main() {
  if (!tenantId && !all) {
    console.error('Usage: node scripts/repair-tenant-modules.mjs <tenantId> [--dry-run]');
    console.error('       node scripts/repair-tenant-modules.mjs --all [--dry-run]');
    process.exit(1);
  }

  if (all) {
    const snap = await db.collection('tenants').get();
    console.log(`Scanning ${snap.size} tenant(s)...`);
    for (const doc of snap.docs) {
      await repairTenant(doc.id, doc.data());
    }
  } else {
    const ref = db.doc(`tenants/${tenantId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error(`Tenant "${tenantId}" not found.`);
      process.exit(1);
    }
    await repairTenant(tenantId, snap.data());
  }
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
