# CZiumERP — Multi-Tenant Operations Guide

## Architecture at a glance

```
                    ┌─────────────────────────────┐
                    │  SUPER ADMIN (your company) │
                    │  /super-admin console       │
                    │  claims: superAdmin: true   │
                    └──────────────┬──────────────┘
                                   │ creates / suspends / templates
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
 /tenants/acme             /tenants/globex             /tenants/initech
   settings/app              settings/app                settings/app
   users, invoices,          users, invoices,            users, invoices,
   products, ledger…         products, ledger…           products, ledger…
        ▲                          ▲                          ▲
   claims:                    claims:                     claims:
   tenantId=acme              tenantId=globex             tenantId=initech
   role=admin|manager|…       role=…                      role=…
```

Cross-tenant access is impossible **by structure**: all business data lives
under `/tenants/{tenantId}/…` and every security rule requires the caller's
`tenantId` custom claim to equal the path segment. There is no query a client
can write that reaches another tenant's data.

## Identity tiers

| Tier | Claim | Created by | Can do |
|---|---|---|---|
| Super Admin | `superAdmin: true` | `manage-auth-users.mjs superadmin <email>` | Everything across all tenants; /super-admin console |
| Tenant Admin | `tenantId` + `role: admin` | Super admin (script/console) or another tenant admin (invite) | Manage users/roles, toggle modules within allowance, all settings |
| Manager / Cashier / Inventory | `tenantId` + role | Tenant admin (in-app invite → `inviteUser` function) or script | Day-to-day ERP work per the role matrix |

## Bootstrapping a fresh deployment

```bash
# 1. Deploy rules and (recommended) functions
npx firebase-tools deploy --only firestore:rules
cd functions && npm install && npm run deploy && cd ..

# 2. Make yourself the platform operator
node scripts/manage-auth-users.mjs create ops@yourcompany.com 'Str0ngPass!' admin --tenant bootstrap
node scripts/manage-auth-users.mjs superadmin ops@yourcompany.com

# 3. Sign in → you land on /super-admin → create the first tenant
#    (pick an industry template: retail / manufacturing / services / distribution)

# 4. Provision the tenant's dedicated engineer (Tenant Admin)
node scripts/manage-auth-users.mjs create engineer@client.com 'TheirPass!1' admin --tenant acme-trading "Client Engineer"

# 5. The Tenant Admin signs in and invites staff from the Users page
#    (requires the inviteUser Cloud Function; otherwise use the script)
```

## Migrating an existing single-tenant install

```bash
node scripts/migrate-to-tenant.mjs acme-trading --dry-run   # preview
node scripts/migrate-to-tenant.mjs acme-trading             # copy
node scripts/manage-auth-users.mjs settenant user@acme.com acme-trading  # per user
# verify in the app, then:
node scripts/migrate-to-tenant.mjs acme-trading --delete-source
```

## Modularity (Odoo/Zoho-style)

- **Super admin** sets `allowedModules` per tenant (plan-driven) when creating
  the workspace — industry templates pre-fill this.
- **Tenant admin** toggles modules in Settings → Modules. The toggle updates
  `themeSettings.disabledModules` (drives navigation) and mirrors
  `enabledModules` onto the tenant root doc.
- **Security rules enforce it**: writes to a disabled module's collections are
  denied server-side, and rules reject any `enabledModules` value outside the
  super-admin-granted allowance. Hiding a menu is UX; the rules are the lock.

## Registration & password flows

- **/register** — public "request a workspace" form → `registrationRequests`
  (shape-validated by rules). Super admin approves in the console, which
  creates the tenant from the industry template.
- **Forgot password** — on the login page; sends Firebase's reset email
  without revealing whether the account exists.
- **Email verification** — enforced at login. Admin-provisioned accounts are
  pre-verified; self-serve flows get a verification email automatically.
- **Suspension** — a suspended tenant fails login with a clear message, and
  every rule also checks `tenantActive()`, so existing sessions lose access.

## Server-side layer (functions/)

| Function | Purpose |
|---|---|
| `inviteUser` | Tenant admins create real accounts (+claims, +profile) from the Users page |
| `setUserClaims` | Super-admin user/tenant/role management |
| `auditTrail` | Mirrors every tenant write into a tamper-proof `auditTrail` subcollection |
| `postInvoiceWithLedger` | Atomic invoice + balanced GL + stock decrement with server-side validation |
| `loginRateLimit` | Brute-force counter a refresh can't reset |

The app degrades gracefully when functions aren't deployed (script fallback
for user creation), but production deployments should include them.
