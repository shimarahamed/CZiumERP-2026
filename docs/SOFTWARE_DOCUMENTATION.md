# CZium ERP — Software Documentation

Technical reference for developers and system administrators. For an end-user, feature-by-feature walkthrough, see [FEATURES_GUIDE.md](./FEATURES_GUIDE.md).

---

## 1. Overview

CZium is a multi-tenant ERP web application covering sales, POS, invoicing, inventory, purchasing, manufacturing, shipping, accounting, human resources, project management, service desk, reporting/analytics, and platform administration.

- **Framework**: Next.js 15 (App Router, Turbopack dev server), React 18, TypeScript 5.
- **Backend**: Firebase — Firestore (data), Firebase Authentication (identity), Cloud Functions v2 (`asia-south1` region) for server-authoritative logic.
- **Deployment model**: single Firebase project, many tenants, data path-isolated under `/tenants/{tenantId}/...`.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI components | Radix UI primitives + `class-variance-authority` + Tailwind CSS (shadcn/ui-style system) |
| Icons | `lucide-react` |
| Forms & validation | `react-hook-form` + `zod` |
| State management | React Context (`AppContext`, `PresenceContext`) + custom Firestore-subscription hooks — no Redux/Zustand |
| Charts | `recharts` |
| Command palette | `cmdk` |
| PDF / export | `jspdf`, `html2canvas`, `xlsx` |
| Barcode | `jsbarcode` (generate), `jsqr` (scan) |
| Gantt scheduling | `gantt-task-react` |
| AI | Google Genkit (`genkit`, `@genkit-ai/googleai`, `@genkit-ai/next`) |
| Email | `nodemailer` (server-side, via Cloud Functions) |
| Testing | Vitest |
| Data/backend | `firebase` SDK v11 (Firestore, Auth, Functions) |

---

## 3. Local Development

```bash
npm install
npm --prefix functions install
npm run dev
```

The dev server is pinned to port `9002` (`next dev --turbopack -p 9002`):

```
http://localhost:9002
```

### Verification before shipping changes

```bash
npm run typecheck
npm test
npm run build
npm --prefix functions run build
```

### Key scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js app on port 9002 |
| `npm run typecheck` | TypeScript checks (`tsc --noEmit`) |
| `npm test` | Run Vitest test suite |
| `npm run build` | Production build of the Next.js app |
| `npm --prefix functions run build` | Build Firebase Cloud Functions |
| `npm run genkit:dev` | Start the Genkit AI development server |

### Deployment notes

Deploy Firestore rules and Cloud Functions together whenever backend posting or messaging behavior changes — the web app depends on callable Functions for invoice posting and tenant messaging, and a rules/functions mismatch can break writes.

---

## 4. Architecture

### 4.1 Multi-tenancy

- All tenant business data lives under Firestore path `/tenants/{tenantId}/...`.
- Identity is carried entirely by **Firebase Auth custom claims**: `tenantId`, `role`, `superAdmin`. These claims are set **only server-side** (Admin SDK, via the `setUserClaims` Cloud Function) — the client cannot forge a tenant or role.
- Firestore Security Rules (`firestore.rules`) are deny-by-default. Every rule for tenant data requires the caller's `tenantId` claim to match the path segment being accessed, making cross-tenant reads/writes structurally impossible rather than merely policy-enforced.
- Platform-level collections (`registrationRequests`, `tenantDirectory`, `superAdmins`, `verticalBlueprints`) are separately gated from per-tenant business data and are only accessible to the super-admin console.

### 4.2 Roles & permissions (RBAC)

- **Tenant roles**: `admin`, `manager`, `cashier`, `inventory-staff`.
- **Platform role**: `superAdmin` — a separate flag outside the tenant role system; super admins are routed to `/super-admin` instead of the tenant app.
- `src/lib/rbac.ts` defines `DEFAULT_PERMISSIONS` per role, across modules (General, Sales & Customers, Supply Chain, Manufacturing, Shipping & Logistics, Finance, Human Resources, Project Management, Service Desk, System) and actions (`view`, `create`, `edit`, `delete`, `approve`).
- Tenants can additionally define **custom roles** (Settings → Roles) that refine or override the base-role defaults; a user opts into one via `User.customRoleId`. Effective permissions are resolved through `getEffectivePermissions()`.
- Two enforcement hooks:
  - `useRequireRole(allowedRoles)` — coarse allow-list gate, redirects if the user's role isn't in the list.
  - `useRequirePermission(module, action, redirectOnDeny)` — fine-grained check against effective permissions; most Accounting/HR pages wrap themselves in a "Permission Required" guard so hook order stays stable across renders.

### 4.3 Application shell

- `AuthWrapper.tsx` is the top-level route guard: unauthenticated users → `/login`; super admins → `/super-admin`; authenticated tenant users without a resolved store → `/select-store`; otherwise renders the sidebar navigation shell around the page.
- `AppContext.tsx` (~925 lines) holds the resolved `tenantId` and wires roughly 40 Firestore collections via a `useFirestoreCollection` hook, each scoped by tenant. Sensitive collections (payroll, ledger entries, SMTP/SMS/WhatsApp config) are gated by a manager-or-admin check built into the hook call itself, so lower-privilege roles never subscribe to that data client-side.

### 4.4 Server-authoritative posting

Financial writes are never trusted from the client alone. The canonical example is invoice posting:

- `postInvoiceServerSideFast()` (`src/lib/posting.ts`) calls the `postInvoiceWithLedger` callable Cloud Function (`functions/src/postInvoiceWithLedger.ts`).
- That function performs, inside a single Firestore transaction: invoice number allocation, inventory consumption (stock levels, lots, serial units, service-linked component consumption), General Ledger double-entry posting, and activity-log writes.
- The invoice object the function **returns** — including the server-recomputed `amount` — is what the client actually persists into app state. The server's math is authoritative; the client's own calculation is only a preview.
- `src/lib/posting.ts` also contains a client-side ledger-entry builder (`buildInvoiceLedgerEntries`) used as an offline/fallback path; it mirrors the server's money logic and must be kept in sync with it.

### 4.5 Money arithmetic

Integer-cents arithmetic is implemented independently in three places that must be kept in sync:

- `src/lib/money.ts` — client
- `functions/src/money.ts` — Cloud Functions
- inline in one-off data-repair scripts under `scripts/`, where standalone Node execution precludes importing the shared module

Core primitives: `toCents`, `fromCents`, `addMoney`, `mulMoney`, `percentOf`, `lineTotal`, `formatNumber`, `formatMoney`.

`lineTotal(unitPrice, quantity, discount = 0, discountType: 'percent' | 'amount' = 'percent')` computes a line's net total after its own item-level discount:
- `'percent'` (default): takes a percentage off the gross line total.
- `'amount'`: takes a fixed amount off **each unit** (clamped to ≥ 0), then multiplies by quantity.

Ledger posting for a sale follows standard double-entry: Dr Accounts Receivable (total) / Cr Sales Revenue (net-of-discount, pre-tax) + Cr Taxes Payable (tax); and Dr COGS / Cr Inventory for the cost side (unaffected by discounts).

### 4.6 Ledger entry matching convention

`LedgerEntry` documents do not carry an `invoiceId` field. Entries are matched back to their source invoice by a deterministic `description` string, a convention set by `postInvoiceWithLedger.ts` itself:

- `"Invoice {invoiceId}"` — the AR debit and Sales Revenue credit entries.
- `"Invoice {invoiceId} tax"` — the Taxes Payable credit entry.

Any tooling that needs to reconcile ledger entries to invoices (e.g. data-repair scripts) must use this string convention rather than a foreign key.

### 4.7 Cloud Functions inventory (`functions/src/`)

| File | Responsibility |
|---|---|
| `postInvoiceWithLedger.ts` | Atomic invoice + inventory + GL posting transaction |
| `setUserClaims.ts` | Server-side assignment of `tenantId`/`role`/`superAdmin` auth claims |
| `inviteUser.ts` | User invitation flow |
| `loginRateLimit.ts` | Login attempt throttling |
| `messaging.ts` | SMS / WhatsApp sending (Meta Cloud API) |
| `apiKeys.ts` | Outward REST API key management |
| `restApi.ts` | Public REST API surface for external integrations |
| `computeRollups.ts` | Scheduled nightly pre-aggregation of revenue/COGS/margin/top-products per store |
| `fxRates.ts` | Currency exchange rate fetching |
| `auditTrail.ts` | Activity/audit log writes |
| `superAdminData.ts` / `superAdminUsers.ts` | Platform operator console data operations |
| `money.ts` | Server-side money arithmetic (mirrors `src/lib/money.ts`) |

All Functions run in region `asia-south1` and are invoked via `httpsCallable` from the client — no raw HTTP fetches to provider APIs (SMTP/SMS/WhatsApp) happen in the browser; provider credentials never reach client code.

### 4.8 Security model summary

- Firebase Authentication carries the tenant and role claims used by both the app and Firestore rules.
- Tenant data is stored under `/tenants/{tenantId}`.
- Invoice posting runs through the `postInvoiceWithLedger` callable Function so invoice IDs, ledger entries, stock levels, lots, serials, service-linked inventory, and activity logs update in one backend transaction — eliminating partial-write states.
- SMTP, SMS, and WhatsApp sends run through callable Cloud Functions; browser code never posts provider credentials to Next.js API routes.
- Raw messaging secrets under `smtpConfig`, `smsConfig`, and `whatsappConfig` are readable only by tenant admins per Firestore rules.

---

## 5. Data Model

Defined in `src/types/index.ts`. Grouped by domain:

**Identity & platform**
`User`, `Tenant`, `TenantConfig`, `RegistrationRequest`, `CustomRole`, `RolePermissions`, `ModulePermission`, `PermissionAction`, `VerticalBlueprint`, `CustomFieldDefinition`, `CustomFieldSeed`

**Sales & CRM**
`Customer`, `Lead`, `Campaign`, `Quotation`, `Invoice`, `InvoiceItem`, `RecurringInvoice`, `Refund`, `RefundItem`, `Shipment`

**Supply chain / inventory**
`Product`, `Vendor`, `Warehouse`, `StockLevel`, `Lot`, `SerialUnit`, `PurchaseOrder`, `PurchaseOrderItem`, `VendorBill`, `RFQ`, `RFQItem`, `LandedCostEntry`

**Manufacturing**
`BillOfMaterials`, `BOMItem`, `ProductionOrder`, `QualityCheck`

**Shipping/logistics**
`Shipment` (shared with sales), plus route/vehicle records surfaced under `shipping/*`

**Accounting/Finance**
`LedgerEntry`, `Budget`, `TaxRate`, `IntercompanyTransaction`, `Asset`, `FXRate`

**Human Resources**
`Employee`, `Department`, `AttendanceEntry`, `Timesheet`, `LeaveRequest`, `ExpenseClaim`, `PayrollRun`, `PayrollRunLine`, `Candidate`, `JobRequisition`, `InterviewFeedback`, `PerformanceReview`, `ITAsset`

**Projects & service desk**
`Project`, `Task`, `Ticket`, `TicketComment`

**Approvals & workflow**
`ApprovalWorkflow`, `ApprovalStep`, `ApprovalRule(s)`

**Reporting**
`ReportDefinition`, `ReportSource`, `ReportFilter`, `ReportAggregate`, `ScheduledReport`, `ReportRollup`, `DashboardWidgetId`, `DashboardLayout`

**Collaboration & notifications**
`Notification`, `PresenceRecord`, `ActivityLog`, `ActivityLogChange`, `Attachment`

**Messaging channels**
`SmtpConfig`, `SmsConfig`, `WhatsappConfig`, `EmailTemplateConfig`, `EmailLog`, `MessageLog`

**Integrations**
`ApiKey`, `WebhookEndpoint`

**Misc**
`Sale` (legacy monthly revenue aggregate used for chart data), `Store`

Full field-level shapes are authoritative in `src/types/index.ts` — this document intentionally lists entities, not fields, since fields change more often than the domain model.

---

## 6. Module Map (routes)

All routes live under `src/app/`. Each directory is a Next.js route segment.

| Area | Routes |
|---|---|
| Auth | `login/`, `register/`, `select-store/` |
| Sales | `pos/`, `invoices/`, `quotations/`, `customers/`, `leads/`, `campaigns/`, `returns/`, `payments/`, `upselling/`, `rfq/` |
| Inventory & procurement | `inventory/`, `inventory/cycle-count/`, `purchase-orders/`, `vendors/`, `warehouses/`, `scanner/` |
| Manufacturing | `manufacturing/bom/`, `manufacturing/production/`, `manufacturing/quality/` |
| Shipping | `shipping/shipments/`, `shipping/routes/`, `shipping/vehicles/` |
| Accounting | `accounting/general-ledger/`, `accounting/receivables/`, `accounting/payables/`, `accounting/budgeting/`, `accounting/tax/`, `accounting/reconciliation/`, `accounting/statements/`, `accounting/assets/`, `accounting/intercompany/` |
| Human Resources | `human-resources/dashboard/`, `employees/`, `departments/`, `attendance/`, `timesheets/`, `leave-requests/`, `expenses/`, `payroll/`, `recruitment/`, `jobs/`, `performance/`, `settings/` |
| Projects & service desk | `projects/`, `support/tickets/`, `support/it-assets/` |
| Reporting & AI | `reports/`, `reports/builder/`, `reports/scheduled/`, `analytics/`, `assistant/` |
| Platform admin | `settings/`, `settings/custom-fields/`, `settings/import/`, `settings/roles/`, `users/`, `stores/`, `activity/` |
| Super admin | `super-admin/`, `super-admin/tenants/`, `super-admin/requests/`, `super-admin/blueprints/`, `super-admin/modules/`, `super-admin/users/`, `super-admin/system/` |
| Diagnostics | `testing/data/`, `testing/functional/`, `testing/issues/`, `responsive-test/` |
| API | `api/` (Next.js route handlers) |

---

## 7. Cross-Cutting Features

- **Command palette** (`CommandPalette.tsx`) — `cmdk`-based global search/navigation (Ctrl/Cmd+K).
- **Keyboard shortcuts** (`KeyboardShortcutsModal.tsx`) — reference modal for available shortcuts.
- **Offline support** — `OfflineBanner.tsx` surfaces connectivity state; a service worker (`public/sw.js`) and `public/manifest.json` provide PWA installability and offline caching.
- **Dark / light theme** — `useDarkMode` hook + `ThemeToggle.tsx`; state persisted to `localStorage` (`czium-dark-mode`) and mirrored by a pre-hydration inline script in `layout.tsx` to avoid a flash of the wrong theme. Defaults to light on first visit.
- **Activity log** — per-entity `ActivityFeed.tsx` widget plus a tenant-wide `activity/` page, backed by `ActivityLog`/`ActivityLogChange` with field-level diffs.
- **Presence / collaboration** — `PresenceAvatars.tsx` + `PresenceContext.tsx` show who else is currently viewing a record or route.
- **Automation runner** — `AutomationRunner.tsx`, mounted once in the root layout, drives background automations: `useReorderTriggers` (auto low-stock purchase triggers) and `useRecurringInvoices` (auto-generates invoices due per a `RecurringInvoice` schedule).
- **Notifications** — in-app bell (read/unread, deep-links to records) plus multi-channel outbound delivery (email/SMS/WhatsApp), each independently configurable per tenant with delivery logs.
- **Approval workflows** — configurable multi-step approval chains for purchase orders, invoices, leave requests, expense claims, vendor bills, and RFQs, with threshold amounts and approver resolution (pinned user, requester's manager, or role match).
- **Custom fields & vertical blueprints** — tenant-extensible schema (no code changes) for adapting the data model to a customer/product/invoice per industry vertical; blueprints are managed from the super-admin console.
- **REST API & webhooks** — outward API access via `ApiKey`s, and HMAC-signed webhook events (e.g. `invoice.created`, `stock.low`, `purchase-order.approved`) via `WebhookEndpoint`s.
- **Report rollups** — `computeRollups` nightly Cloud Function pre-aggregates revenue/COGS/margin/top-products per store so dashboards avoid scanning full transaction history.

---

## 8. Testing

- **Unit/invariant tests**: Vitest, under `src/**/__tests__/`. Example: `invoice-posting-invariants.test.ts` asserts structural properties of the posting Cloud Function and its client mirror (e.g. that posting runs inside `db.runTransaction`, that module gates are checked correctly) by reading the source files as text — a guardrail against accidental regressions in security-critical logic without needing a live Firestore emulator.
- **Manual/responsive verification**: `responsive-test/` and `testing/` routes exist for in-browser QA of layout and data flows.
- Run the full check before shipping: `npm run typecheck && npm test && npm run build && npm --prefix functions run build`.

---

## 9. Repository Conventions

- Prefer editing existing files over creating new ones; avoid speculative abstractions.
- Money math must always go through `lib/money.ts` (`lineTotal`, `addMoney`, etc.) — never compute `price * qty` inline, to avoid float-precision drift and to keep discount handling consistent.
- One-off data migrations/repairs live in `scripts/*.mjs`, using the Firebase Admin SDK with `serviceAccountKey.json` (path from `GOOGLE_APPLICATION_CREDENTIALS` or the repo-root default), and support a `<tenantId> [--dry-run]` or `--all [--dry-run]` CLI convention — always dry-run and review output before a live run against production Firestore.
- Firestore batched writes must stay under the 500-operation hard limit; existing scripts flush at 400 to leave headroom.
