#!/usr/bin/env node
/**
 * Provision Firebase Auth accounts, tenant membership, and role claims for CZiumERP.
 *
 * The Firestore security rules require custom claims on every user:
 *   role      — 'admin' | 'manager' | 'cashier' | 'inventory-staff'
 *   tenantId  — the ONE workspace this user belongs to (except super admins)
 *   superAdmin — platform operators only; grants cross-tenant access
 * This script is the ONLY supported way to create users, assign workspaces,
 * or reset passwords — never store passwords in code or Firestore.
 *
 * Setup:
 *   1. Firebase console → Project settings → Service accounts →
 *      Generate new private key → save as serviceAccountKey.json (git-ignored).
 *   2. npm install firebase-admin --no-save
 *
 * Usage:
 *   node scripts/manage-auth-users.mjs create  <email> <password> <role> --tenant <tenantId> [displayName]
 *   node scripts/manage-auth-users.mjs setrole <email> <role> [--tenant <tenantId>]
 *   node scripts/manage-auth-users.mjs settenant <email> <tenantId>
 *   node scripts/manage-auth-users.mjs superadmin <email>          # grant platform access
 *   node scripts/manage-auth-users.mjs setpass <email> <newPassword>
 *   node scripts/manage-auth-users.mjs disable <email>
 *   node scripts/manage-auth-users.mjs list
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const VALID_ROLES = ['admin', 'manager', 'cashier', 'inventory-staff'];
const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccountKey.json';

if (!existsSync(KEY_PATH)) {
  console.error(`Service account key not found at ${KEY_PATH}.`);
  console.error('Download it from Firebase console → Project settings → Service accounts.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const auth = getAuth();

// Parse args, extracting --tenant <id> anywhere on the command line
const rawArgs = process.argv.slice(2);
let tenantId = null;
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--tenant') { tenantId = rawArgs[++i]; continue; }
  args.push(rawArgs[i]);
}
const [cmd, email, arg3, arg4] = args;

function assertRole(role) {
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }
}

async function main() {
  switch (cmd) {
    case 'create': {
      const [password, role, displayName] = [arg3, arg4, args[4]];
      if (!email || !password || !role) return usage();
      assertRole(role);
      if (!tenantId) {
        console.error('A tenant is required: add --tenant <tenantId>. (Use the superadmin command for platform operators.)');
        process.exit(1);
      }
      if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
      }
      // emailVerified: true — admin-provisioned accounts skip the verification gate
      const user = await auth.createUser({ email, password, displayName, emailVerified: true });
      await auth.setCustomUserClaims(user.uid, { role, tenantId });
      console.log(`Created ${email} (uid ${user.uid}) with role "${role}" in tenant "${tenantId}".`);
      break;
    }
    case 'setrole': {
      const role = arg3;
      if (!email || !role) return usage();
      assertRole(role);
      const user = await auth.getUserByEmail(email);
      const prev = user.customClaims ?? {};
      await auth.setCustomUserClaims(user.uid, { ...prev, role, ...(tenantId ? { tenantId } : {}) });
      // Force token refresh so the new claims take effect on next sign-in
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Set role "${role}"${tenantId ? ` and tenant "${tenantId}"` : ''} for ${email}. User must sign in again.`);
      break;
    }
    case 'settenant': {
      const newTenant = arg3;
      if (!email || !newTenant) return usage();
      const user = await auth.getUserByEmail(email);
      const prev = user.customClaims ?? {};
      await auth.setCustomUserClaims(user.uid, { ...prev, tenantId: newTenant });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Moved ${email} to tenant "${newTenant}". User must sign in again.`);
      break;
    }
    case 'superadmin': {
      if (!email) return usage();
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { superAdmin: true, role: 'admin' });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`${email} is now a PLATFORM SUPER ADMIN with cross-tenant access.`);
      break;
    }
    case 'setpass': {
      const password = arg3;
      if (!email || !password) return usage();
      if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
      }
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Password updated for ${email}. Existing sessions revoked.`);
      break;
    }
    case 'disable': {
      if (!email) return usage();
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { disabled: true });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Disabled ${email} and revoked sessions.`);
      break;
    }
    case 'list': {
      const { users } = await auth.listUsers(1000);
      for (const u of users) {
        const c = u.customClaims ?? {};
        console.log(
          `${u.email}\trole=${c.role ?? '(none)'}\ttenant=${c.superAdmin ? 'SUPER-ADMIN' : (c.tenantId ?? '(none)')}\t${u.disabled ? 'DISABLED' : 'active'}`
        );
      }
      break;
    }
    default:
      usage();
  }
}

function usage() {
  console.log(`Usage:
  node scripts/manage-auth-users.mjs create    <email> <password> <role> --tenant <tenantId> [displayName]
  node scripts/manage-auth-users.mjs setrole   <email> <role> [--tenant <tenantId>]
  node scripts/manage-auth-users.mjs settenant <email> <tenantId>
  node scripts/manage-auth-users.mjs superadmin <email>
  node scripts/manage-auth-users.mjs setpass   <email> <newPassword>
  node scripts/manage-auth-users.mjs disable   <email>
  node scripts/manage-auth-users.mjs list

Roles: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
