# Production Hardening — Change Log

## Security (critical)
- **firestore.rules**: replaced `allow read, write: if true` (public database) with
  deny-by-default, per-collection, role-based rules driven by Firebase Auth custom
  claims. Ledger is append-only for managers; activity logs are immutable.
- **Authentication**: replaced hardcoded-credential login with real Firebase Auth
  (`signInWithEmailAndPassword`). Removed the `SEED_CREDENTIALS` map and all
  plaintext passwords from `src/lib/data.ts`. Logout now revokes the Firebase session.
- **User management** (`src/app/users/page.tsx`): creating a user now provisions a
  real Firebase Auth account via a secondary app instance; passwords are never
  stored on user objects. Password resets route to the admin script.
- **scripts/manage-auth-users.mjs**: new Admin SDK script — create users, set role
  claims, reset passwords, disable accounts, revoke sessions.
- **next.config.ts**: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy,
  Permissions-Policy headers on all routes.
- **.gitignore**: service account keys and .env files excluded.

## Bug fixes
- Fixed React rules-of-hooks violations in 18 pages (16 permission guards that
  early-returned before hooks, now a wrapper-component pattern; 2 loading guards
  in assets and reports pages moved after hooks — these could crash on data
  hydration).
- Escaped 16 unescaped JSX entities across 9 files.

## Quality infrastructure
- ESLint configured (`next/core-web-vitals`) — 0 errors.
- Vitest added with RBAC permission-matrix unit tests (7 passing).
- GitHub Actions CI: typecheck + lint + tests + secret/rules guards + production build.
- `.env.example`, `DEPLOYMENT.md` added.

## Verification
- `npm run typecheck` — clean
- `npm run lint` — 0 errors
- `npm run test` — 7/7 passing
- `npm run build` — all routes compile

---

# Phase 2 — Multi-Tenant SaaS Transformation

## Architecture
- Tenant data model: all 35 business collections moved to /tenants/{tenantId}/... subcollections.
- Identity tiers via custom claims: superAdmin (platform), tenantId+role (workspace members).
- firestore.rules rewritten for the tenant tree: cross-tenant access denied by structure,
  suspended-tenant lockout on every rule, module-gated writes, validated public registration.
- Data layer rewritten (use-firestore-collection): DIFF-BASED per-document writes replace the
  full-collection rewrite — concurrent editors can no longer wipe each other's records; no
  read-back of the whole collection on save; 450-op batch chunking; demo seeding gated behind
  NEXT_PUBLIC_ENABLE_DEMO_SEED (never runs in production).

## Identity & login
- Login: tenant claims resolution, suspended-workspace check, email-verification gate,
  self-healing profile creation, pending spinner, no-workspace error messaging.
- "Forgot password?" (Firebase reset email, non-enumerating) and "Register organization"
  (public request → super-admin approval) added to the login screen.
- Session claim restore on refresh via onAuthStateChanged.
- Per-tenant settings: branding/modules persist to /tenants/{id}/settings/app (was localStorage).
- Tenant admins toggle modules within a super-admin-granted allowance — enforced in rules.

## Consoles & pages
- /super-admin: tenant lifecycle (create/suspend/reactivate), industry templates
  (retail/manufacturing/services/distribution), module allowance, registration approvals.
- /register: public organization signup request.
- Legacy /settings/tenants page superseded (redirects to /super-admin); Nav updated.
- Presence tracking scoped per tenant.

## Server-side layer (functions/, deploy-ready)
- inviteUser (in-app user creation with claims), setUserClaims, auditTrail (tamper-proof),
  postInvoiceWithLedger (atomic invoice+balanced GL+stock with server validation),
  loginRateLimit (refresh-proof brute-force counter).
- Users page invites via the function with a script fallback message.

## Exception handling
- Route error boundary (app/error.tsx) + last-resort global-error.tsx: no white screens.
- Offline banner with sync messaging. Firestore error/rollback toasts (already present) retained.

## Security & quality extras
- Content-Security-Policy, COOP, CORP headers added.
- Dependabot (app + functions + actions) and npm audit step in CI.
- Integer-cents money utilities (src/lib/money.ts) + 6 unit tests.
- useDebounce hook for large-list search inputs.
- Dead User.password field removed from the type system.
- Migration script (migrate-to-tenant.mjs): dry-run, idempotent copy, optional source cleanup.
- manage-auth-users.mjs: --tenant flag, settenant, superadmin commands; pre-verified accounts.

## Verification
- typecheck clean · lint 0 errors · 13/13 tests · production build compiles all routes

---

# Phase 3 — Production Features & Polish

## Document templates (invoices / POS / receipts)
- 4 templates in FullInvoice: Classic, Modern (color banner), Minimal, POS Thermal Receipt (80mm)
- Tenant-admin controls in Settings → Company & Branding: template gallery, custom footer text,
  header accent color picker, show/hide logo on documents
- All printed math converted to integer-cents (money.ts) — no float drift on documents

## Admin-changeable system colors
- 8 curated WCAG-AA-safe quick palettes (one-click restyle) alongside the existing custom pickers
- Live contrast validation warns when white-on-primary fails WCAG AA (src/lib/palettes.ts + 4 tests)

## Mobile-first responsiveness
- Global CSS layer: 16px inputs (kills iOS zoom-on-focus), 44px touch targets, tighter phone padding,
  dialog max-height with inner scroll, card grids collapse to single column on phones
- Invoice templates responsive (stacked headers on small screens); tables scroll horizontally

## Tier-1 items
- Race-safe sequential invoice numbering: atomic Firestore counter (document-number.ts) wired into
  both invoice creation flows, replacing scan-max+1 (two cashiers could get the same number)
- Debounced search (250ms) on invoices, inventory, customers lists
- Custom Role Builder (/settings/roles): module × action permission matrix per tenant, stored at
  /tenants/{id}/roles, rules-gated to tenant admins
- postInvoiceServerSide helper: routes posting through the transactional Cloud Function with a
  safe client fallback when functions aren't deployed

## Chosen feature: CSV Bulk Import (/settings/import)
- Products & customers import with downloadable templates, quoted-CSV parser, per-row validation
  with line-numbered errors, 10-row preview before committing

## Ops
- scripts/backup-firestore.sh: GCS export with 30-day lifecycle setup instructions
- Rules extended: roles, counters, auditTrail (server-write-only) collections
- Nav: Custom Roles + Bulk Import entries

## Verification: typecheck clean · lint 0 errors · 17/17 tests · build compiles all routes
