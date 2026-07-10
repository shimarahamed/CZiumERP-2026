# CZiumERP — Production & Multi-Tenant Improvement Plan

> Planning document only — no code changes. Every finding below was verified against the current source unless marked **(verify)**. Items marked **(verify)** are strong patterns worth confirming per-page before fixing.

---

## 0. Current-state verdict

The app is a broad, well-scaffolded **single-tenant** ERP. After the security pass it is safe to hold one client's data in one Firebase project. To sell it as a product to many clients from one deployment — the Odoo/Zoho model you described — three things are missing at the foundation: a **tenant concept**, a **scalable data-access layer**, and an **identity/onboarding system**. Everything else (features, UI polish, exception handling) sits on top of those three.

The blocker is architectural, not cosmetic. Two facts drive the whole plan:

1. **No tenant exists.** Records carry an optional `storeId`, but there is one shared Firestore namespace. "Stores" are branches of one company, not isolated tenants.
2. **`useFirestoreCollection` rewrites the entire collection on every write.** `setCollection` reads *all* docs, diffs against the in-memory array, and **deletes any doc not present**. This loads whole collections into browser memory, breaks at scale, and causes **silent data loss** when two users edit concurrently (last writer wipes the other's new records). This hook must be replaced before multi-tenancy or scale is possible.

---

## 1. Target architecture — proper multi-tenant SaaS

### 1.1 The three-tier identity model you asked for

| Tier | Who | Scope | Capabilities |
|---|---|---|---|
| **Super Admin** | Your software company | ALL tenants | Create/suspend tenants, see cross-tenant metrics, impersonate for support, set which industry template + modules a tenant gets, billing, global audit. Lives in a separate console, not the tenant app. |
| **Tenant Admin** | The dedicated engineer per client | ONE tenant | Enable/disable modules, configure everything, create users, define roles, assign role→user, branding, tax/currency, approval thresholds. Cannot see other tenants. |
| **Roles (Manager / Cashier / Inventory / custom)** | Client staff | ONE tenant, scoped further by store/branch | Do the actual ERP work, gated by the permissions the Tenant Admin assigned. |

### 1.2 Data model — tenant isolation by structure

Move from flat top-level collections to **tenant-scoped subcollections**. This is what makes cross-tenant access impossible *by structure*, not just by a `where` clause someone can forget.

```
/tenants/{tenantId}                      ← tenant profile, industry, plan, enabledModules
   /users/{userId}                       ← membership + role within THIS tenant
   /invoices/{invoiceId}
   /products/{productId}
   /customers/{customerId}
   ... (every current collection becomes a subcollection)
   /settings/{singleton}                 ← branding, tax, currency, thresholds (today in localStorage)
   /auditLogs/{logId}                    ← immutable

/superAdmins/{uid}                       ← your staff only
/tenantDirectory/{tenantId}              ← lightweight lookup: name, status, plan (for the super-admin console)
/userTenantIndex/{uid}                   ← which tenant(s) a user belongs to, for login routing
```

Why subcollections beat a `tenantId` column: security rules can match `/tenants/{tenantId}/...` and check the claim once; a forgotten `.where('tenantId','==',x)` can never leak another tenant because the path itself is scoped.

### 1.3 Identity & claims

- Firebase Auth remains the credential store. Add **custom claims**: `{ role, tenantId, isSuperAdmin }`.
- A user belongs to a tenant via `tenantId` claim (single-tenant-per-user is simplest and covers your model). Multi-tenant membership (one email, several clients) is a later option via `/userTenantIndex`.
- Claims are set only by the provisioning backend (Cloud Function / Admin SDK), never by the client.

### 1.4 Login → tenant selection flow

Two supported patterns — pick one:

- **Subdomain routing (recommended, Zoho/Odoo-style):** `clientA.czium.app`. The subdomain resolves `tenantId` before login; user only sees their tenant. Cleanest isolation, best UX.
- **Tenant picker after auth:** user signs in, and if their account maps to multiple tenants they pick one; single-tenant users skip straight through. Simpler to ship first.

### 1.5 Modularity engine (Odoo/Zoho parity)

You already have the seed of this: `ThemeSettings.disabledModules` and a Module Management tab exist — but it's stored in **localStorage**, so it's per-browser, not per-tenant, and not enforced. Turn it into a real engine:

- Move module state to `/tenants/{id}` as `enabledModules: Module[]`, seeded from an **industry template** at tenant creation (Retail, Manufacturing, Services, Distribution…).
- Enforce at three layers: navigation (hide), routing (guard redirects if module off), and **security rules** (deny writes to a disabled module's collections). Enforcing only in the UI is not enforcement.
- Super Admin controls which modules a tenant is *allowed* to enable (by plan); Tenant Admin toggles within that allowance.

---

## 2. Login & identity gaps (your specific asks)

Currently the login screen has **no registration, no password reset, no forgot-username, no tenant selection**. Lockout is React state that resets on refresh. Fixes:

| Gap | Fix | Notes |
|---|---|---|
| No self-registration | Add **"Request access / Register organization"** flow → creates a *pending tenant* the Super Admin approves. Individual users are **invited by their Tenant Admin**, not self-registered (correct for B2B ERP). | Public self-signup for staff would break tenant isolation — use invites. |
| No password reset | Add **"Forgot password?"** link → Firebase `sendPasswordResetEmail`. | One SDK call; needs email template config. |
| No forgot-username | Username *is* the email; add helper text "Your username is your work email." | |
| No email verification | Enforce `emailVerified` before first login; send verification on invite acceptance. | |
| Lockout resets on refresh | Move rate-limiting server-side (Cloud Function counter or Firebase App Check + Identity Platform lockout). Client lockout is cosmetic and bypassable. | Currently bypass = refresh page. |
| No "remember me" / session length control | Configure Firebase persistence (local vs session) with an explicit toggle. | |
| No tenant selection | Add the tenant resolution from §1.4. | |
| No MFA | Offer TOTP/SMS MFA for admin roles via Firebase MFA. | High value for enterprise sales. |

---

## 3. Remaining cybersecurity issues (post-hardening)

The earlier pass fixed the critical ones (open rules, fake auth, plaintext passwords). What remains:

**High**
- **Full-collection rewrite hook** is also a security/integrity issue: any authenticated user with write access can, through a race, delete records. Replace with per-document writes (see §5).
- **Mock data auto-seeds into Firestore in production** — `use-firestore-collection.ts` writes seed data when a collection is empty. A fresh production tenant gets fake products/customers. Gate seeding to non-production only.
- **No server-side enforcement of business invariants.** Rules gate *who* can write, not *what*. A malicious client can still post an unbalanced ledger entry or negative stock. Move financial/stock mutations to Cloud Functions (transactions). Rules alone can't validate cross-document math.
- **Rate limiting / brute-force** is client-side only (§2).

**Medium**
- **No Firebase App Check** — API is callable from any origin with the public config. Add App Check (reCAPTCHA/Play Integrity) so only your app can call Firestore/Functions.
- **No Content-Security-Policy header** — you added HSTS/X-Frame etc., but no CSP. Add a strict CSP to blunt XSS.
- **Audit log is client-written** — activity logs are created from the browser and can be spoofed or omitted. Write them server-side (Function trigger) so they're tamper-proof.
- **Secrets in AI flows** — confirm `GOOGLE_GENAI_API_KEY` is server-only (Genkit runs server-side) and never bundled. **(verify)**
- **File uploads** (invoice attachments) — validate type/size, scan, and store with authenticated download URLs, not public. **(verify how attachments are stored)**

**Low / Informational**
- Add dependency scanning (Dependabot/`npm audit` in CI — CI exists now, wire the audit step).
- Session revocation on role change is handled by the admin script (`revokeRefreshTokens`); ensure the app forces token refresh so claim changes take effect immediately.
- Add security headers `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`.

---

## 4. Exception handling — make it universal

Today only ~11 of 54 pages wrap operations in try/catch, and the Firestore hook swallows errors to `console.error` (invisible to users). Strategy to cover everything without touching every page by hand:

1. **Global React Error Boundary** — wrap the app shell so any render crash shows a friendly "Something went wrong, retry" card instead of a white screen. Add per-route boundaries for module isolation (Next.js `error.tsx` per segment).
2. **Centralize the data layer** (§5). When all writes go through one service, error handling, rollback, and toasts live in *one* place instead of 54.
3. **Surface the errors the hook already catches.** The `errorEmitter` emits `permission-error` and `rollback` — wire a global listener that shows a toast ("You don't have permission" / "Save failed, changes reverted") instead of only logging.
4. **Async boundary rule:** every `await` in an event handler gets try/catch → user-facing toast + log. Codify as an ESLint rule + PR checklist so it can't regress.
5. **Network/offline state:** the app already toggles Firestore network; add a visible "You're offline — changes will sync" banner and disable destructive actions while offline.
6. **Form-level validation errors:** standardize on `react-hook-form` + `zod` (already used in places) everywhere, with inline field errors, not just toasts.
7. **Genkit/AI calls:** wrap every flow call with timeout + fallback UI ("AI is unavailable, try later") — these fail differently from Firestore.
8. **Uncaught promise + global window error handler** → route to a logging service (Sentry).

Outcome for the end user: no white screens, no silent failures, every failed action explains itself and offers a retry.

---

## 5. The data-layer refactor (prerequisite for scale + tenancy)

Replace `useFirestoreCollection`'s whole-array model with:

- **Per-document writes:** `addDoc` / `updateDoc(doc, ...)` / `deleteDoc(doc)` — never rewrite the collection.
- **Scoped, paginated reads:** query `/tenants/{id}/{collection}` with `where`, `orderBy`, `limit`, and cursor pagination. Stop loading entire collections into context.
- **Optimistic updates with per-doc rollback** (keep the good part of the current hook).
- **React Query (TanStack) or Firestore's own cache** for caching, background refetch, and loading/error states out of the box — this also solves half of §4.

This single refactor fixes: scalability (§7-equivalent), concurrent-write data loss, memory bloat, and centralizes error handling.

---

## 6. UI / UX problems + fixes

### 6.1 Color & theming
- **Theme is localStorage-only** (`themeSettings`) — per-browser, lost on new device, not per-tenant. Move to `/tenants/{id}/settings`. Each tenant gets its own branding, applied at load.
- **User-set arbitrary colors can fail contrast** — `primaryColor`/`accentColor`/`backgroundColor` are free-form. Add contrast validation (WCAG AA) and a curated palette picker so a tenant can't make text unreadable.
- **No enforced dark-mode token discipline** — verify every custom color path has a dark variant; hardcoded colors go invisible in dark mode. **(verify per-component)**
- **Semantic color consistency** — standardize status colors (paid/pending/overdue, in-stock/low/out) into one token set used everywhere, rather than per-page ad hoc classes. **(verify)**

### 6.2 Layout & alignment (confirm each on the running app, but these are the usual suspects here)
- **Login card** is fixed `max-w-sm` with no responsive padding on very small screens — check overflow on 320px. Add register/reset links (currently absent, leaving dead space).
- **Tables** across modules likely overflow horizontally on mobile with many columns — add responsive column hiding or horizontal scroll wrappers. **(verify)**
- **Loading skeletons** were sometimes placed inconsistently (we fixed two that ran before hooks); audit that every list page shows a skeleton, not a blank flash.
- **Empty states** — confirm every list has a friendly "No records yet — add your first" state, not an empty table. **(verify)**
- **Form dialogs** — check consistent spacing, button order (Cancel left / Confirm right), and that long forms scroll within the dialog rather than off-screen. **(verify)**
- **Toast overload** — many actions fire toasts; ensure they're not stacking or blocking content, and that destructive confirmations use dialogs, not just toasts.

### 6.3 Interaction & feedback
- **No global loading indicator** on route changes beyond a hook — ensure navigation shows progress.
- **Buttons don't show pending state** during async saves — add spinners/disabled state so users don't double-submit (this also prevents duplicate records).
- **Destructive actions** — verify every delete has a confirm dialog (some do). Standardize copy.
- **Keyboard/focus** — dialogs should trap focus and close on Esc; verify Radix defaults aren't overridden. **(verify)**

### 6.4 Accessibility
- Login has good aria wiring; extend that discipline: every icon-only button needs `aria-label`, every input a `<label>`, color never the sole signal for status.
- Run axe/Lighthouse per page; target WCAG AA.

---

## 7. Small / minute bugs (confirmed + high-probability)

**Confirmed in code:**
- **Money handled as floats** — prices/costs/tax multiply as JS numbers; rounding drift will show wrong totals and cents. Switch to integer-cents (or decimal library) across invoices, GL, payroll, tax.
- **`User.password?` still exists in the type** (`src/types/index.ts`) — now unused for auth but the optional field invites reintroduction. Remove it from the type once no code reads it.
- **Seed data writes to production** (`use-firestore-collection.ts`) — see §3.
- **Role-based redirect assumes only admin/manager skip store select** — cashiers/inventory always go to `/select-store`, but with no tenant/store data that flow can dead-end. Re-examine under the tenant model.
- **Lockout state non-persistent** (login) — resets on refresh.

**High-probability (verify on running app):**
- Currency symbol/format may not follow the tenant's locale everywhere (mixed `$` hardcoding vs. `currencySymbol`). **(verify)**
- Date formatting likely inconsistent (raw ISO strings vs. formatted) across modules. **(verify)**
- Pagination absent on long lists → slow render + scroll jank. **(verify)**
- Search/filter inputs may not debounce → lag on large lists. **(verify)**
- Optimistic update + rollback can briefly show a record that then vanishes on failure — needs a clear "save failed" toast (tie to §4.3).
- Concurrent edits overwrite each other (the hook) — see §5.

---

## 8. Features & functions to add

### 8.1 Platform / SaaS (needed to sell it)
- Super-Admin console (separate app): tenant CRUD, suspend/reactivate, plan/billing, usage metrics, support impersonation, global audit.
- Tenant onboarding wizard: pick industry template → auto-enable modules → seed chart of accounts → invite first admin.
- Billing & subscription (Stripe): plans gate module allowance and user seats.
- Per-tenant backup/export & data-portability (GDPR "export my data").
- Tenant-level audit trail (immutable, server-written).
- Notification system: email/in-app for approvals, low stock, overdue invoices (partly exists in-app — add email).

### 8.2 Identity / admin (the Tenant-Admin control plane)
- Custom role builder (beyond the 4 fixed roles): create roles, tick module×action permissions, assign to users. `ModulePermission` type already exists — build the UI + persistence.
- User invitation flow with email, role pre-assignment, and acceptance.
- Per-user store/branch scoping.
- MFA, session management, "sign out everywhere."

### 8.3 ERP depth (enterprise-gap closers)
- **Accounting:** double-entry enforcement, period close, multi-currency revaluation, sequential document numbering, financial statements (P&L, balance sheet, cash flow).
- **Approvals:** a real workflow engine (multi-step, conditional) — a panel exists; make it configurable per tenant.
- **Inventory:** multi-warehouse transfers, stock valuation (FIFO/AVCO), batch/serial tracking, negative-stock prevention (server-side).
- **Reporting:** scheduled reports, export to Excel/PDF (partly present), a BI/warehouse export for large tenants.
- **Integrations:** a public REST/API layer + webhooks (currently none) so tenants can connect other tools.

### 8.4 AI (you already run Genkit — low lift)
- Invoice OCR (upload → auto-fill), demand forecasting (a flow exists — expand), NL reporting ("show me overdue invoices in Q2"), RAG document search over tenant docs, anomaly detection on ledger.

---

## 9. Phased execution roadmap

**Phase A — Foundation (blocks everything, ~3–4 wks, 2 devs)**
1. Tenant data model + migration of existing collections to subcollections.
2. Custom claims (`tenantId`, `role`, `isSuperAdmin`) + provisioning backend.
3. Rewrite Firestore rules for the tenant tree (deny cross-tenant by path).
4. Replace `useFirestoreCollection` with the per-doc, paginated, tenant-scoped data layer (§5).
5. Gate seed data out of production.

**Phase B — Identity & access (~2–3 wks)**
6. Login: tenant resolution, forgot-password, invite-based registration, email verification, server-side lockout.
7. Tenant-Admin console: user management, custom role builder, module toggles persisted per tenant + enforced in rules.
8. Global Error Boundary + `errorEmitter` toast wiring + async-handler ESLint rule (§4).

**Phase C — Super Admin & SaaS (~3–4 wks)**
9. Super-Admin console (separate app): tenant lifecycle, industry templates, impersonation, audit.
10. Billing/subscription + plan-gated modules.
11. Server-written audit logs, App Check, CSP.

**Phase D — Integrity & polish (~3–4 wks)**
12. Move financial/stock mutations to Cloud Functions with transactions; integer-cents money.
13. UI/UX pass: theming-per-tenant, contrast validation, empty states, pending button states, table responsiveness, accessibility audit.
14. Remove dead `password` field; date/currency formatting consistency; pagination + debounced search everywhere.

**Phase E — Depth & AI (ongoing)**
15. ERP-depth features (§8.3), public API, AI features (§8.4), test coverage to 80% on money paths.

---

## 10. Scorecard (target after this plan)

| Area | Now | After plan |
|---|---|---|
| Multi-tenancy | 0 | 9 |
| Security | 6 (post-hardening) | 9 |
| Data integrity | 2 | 9 |
| Scalability | 2 | 8 |
| Exception handling | 3 | 9 |
| UI/UX | 5 | 8 |
| ERP completeness | 7 | 9 |
| Modularity (Odoo/Zoho parity) | 3 | 9 |
| Production readiness | 2 | 9 |

---

## 11. What to decide before Phase A starts

1. **Tenant routing:** subdomain (`clientA.czium.app`) or post-login picker? (Recommend subdomain.)
2. **One user = one tenant, or can one email serve several tenants?** (Recommend one-per-tenant first.)
3. **Firebase-only, or add Cloud Functions now?** (Functions are required for integrity §5/§8.3 — recommend yes.)
4. **Industry templates at launch** — which verticals ship first (Retail? Manufacturing? Services?).
5. **Billing provider** and plan tiers (drives module gating).

Answer these five and Phase A can begin.
