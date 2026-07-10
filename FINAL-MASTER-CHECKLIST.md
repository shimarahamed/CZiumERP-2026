# CZiumERP — FINAL MASTER CHECKLIST (every item accounted for)

Legend: ✅ Shipped & verified in this codebase · 📦 Code-complete, needs your deploy/config · 🔜 Planned — architecture + next step given · ❌ Out of scope for this product stage — reason given

═══════════════════════════════════════════
PART A — MY AUDIT GAPS (from the 20-phase checklist)
═══════════════════════════════════════════
1. Pagination on list pages — 🔜 debounce shipped; cursor pagination = swap useMemo filters for Firestore query(limit, startAfter) per page. Next step: invoices page first.
2. Server-side posting as default path — 📦 function schema now matches real LedgerEntry shape; helper ready. NOT blind-wired: client flow intertwines stock+loyalty+notifications, wiring without functions deployed would double-decrement stock. Next step: deploy functions, then wrap the stock-mutation block in `if (!await postInvoiceServerSide(inv))`.
3. Financial Statements — ✅ SHIPPED: /accounting/statements — P&L, Balance Sheet (with balance verification), Cash Flow (direct method), period presets + custom range, print, account auto-classification, 5 tests.
4. E2E tests / 90% coverage — 🔜 22 unit tests now; next step: `npm i -D playwright`, record login→invoice→statement flow.
5. Architecture diagram — ✅ SHIPPED: docs/ARCHITECTURE.md (mermaid, renders on GitHub) + trust boundaries.
6. Firestore composite indexes — ✅ SHIPPED: firestore.indexes.json (6 indexes). Deploy: `firebase deploy --only firestore:indexes`.
7. Monitoring/Sentry/health checks — ❌ needs your Sentry account. Next: `npx @sentry/wizard@latest -i nextjs`.
8. Public REST API — 🔜 architecture: Cloud Functions HTTP endpoints + API-key collection + per-tenant scoping; OpenAPI spec first.
9. File upload security — ✅ SHIPPED: logo upload now validates type (PNG/JPEG/WebP/SVG) + 512KB limit.

═══════════════════════════════════════════
PART B — YOUR ENTERPRISE WISHLIST (all 15 sections)
═══════════════════════════════════════════

## 1. Core ERP
FINANCE: Multi-currency ✅(exists) · Recurring invoices ✅(exists) · Budgets ✅(exists) · Asset mgmt ✅(exists) · Financial dashboards ✅(reports) · **Financial statements ✅ SHIPPED TODAY** · Consolidated statements 🔜(needs multi-company: aggregate statements across tenant's stores — engine already accepts any entry set) · Multi-company accounting 🔜(model: stores→companies with per-company ledger tag) · Automated tax engine 🟡(tax rates exist; automation = rules per region) · Cost/profit centers 🔜(add `centerId` to LedgerEntry + filter in statements engine) · Depreciation 🔜(scheduled function posting monthly entries from assets) · Bank reconciliation 🔜(CSV bank import — reuse the CSV import parser — + match UI) · Cash flow forecasting 🔜(extend existing Genkit forecast flow with ledger data) · Credit limits 🔜(field on Customer + check in invoice onSubmit) · Payment reminders 🔜(scheduled function + email provider)
SALES/CRM: Leads ✅ · Campaigns ✅ · Upselling ✅ · Sales forecasting ✅(Genkit flow exists) · Customer 360 🟡(customer page exists; timeline aggregation next) · Quotation/CPQ 🔜(clone invoice form → quote type + convert-to-invoice) · Email/WhatsApp integration ❌(needs provider accounts: SendGrid/Twilio) · Commissions 🔜(rate on User + report from paid invoices) · Customer portal 🔜(see §10) · Digital signatures 🔜(canvas capture → attach to invoice) · Subscription billing 🟡(recurring invoices exist; dunning next) · Loyalty ✅(exists — tiers/points live in invoice flow)
PROCUREMENT: Requisitions/RFQ ✅(exists) · Vendor comparison 🟡 · Purchase approvals ✅(approval panel exists) · Vendor portal 🔜(§10) · Blanket POs/contracts/scorecards 🔜(fields + report pages on existing PO module)
INVENTORY: Barcode/QR ✅(scanner page exists) · Multi-warehouse ✅(stores) · Batch/serial/expiry 🟡(expiry exists; serial = array field + picker) · Bin locations/cycle counting/wave picking/heat maps 🔜(warehouse sub-module; bin = field on product-per-store) · Stock reservation 🔜(reserved counter + available = stock − reserved) · Inventory forecasting ✅(Genkit flow exists)
MANUFACTURING: BoM ✅ · Production orders ✅ · Quality ✅ · MRP/capacity/shop-floor/machine-monitoring 🔜(MRP = explode BoM vs stock vs POs; IoT needs hardware — §15)
HR: Recruitment ✅ · Attendance ✅ · Leave ✅ · Performance ✅ · Payroll 🟡(page exists; automation = scheduled run) · OKRs/self-service/expenses/travel/timesheets/training/org-chart 🔜(each = collection + page on the established pattern; self-service = new 'employee' role in role builder)

## 2. AI FEATURES (Genkit already wired — cheapest wins)
NL assistant ("show unpaid invoices") 🔜 — flow with tool-calling over Firestore queries; command palette exists as the UI entry. OCR (invoice/receipt/ID) 🔜 — Gemini vision flow + upload → prefill invoice form. Forecasting ✅(sales+inventory flows exist) · churn/cash-flow prediction 🔜(same pattern, new prompts). Auto-categorize expenses / suggest GL accounts 🔜 — classifyAccount() shipped today is the deterministic base; AI layer refines. Duplicate invoice/fraud/anomaly detection 🔜(flow over ledger). AI reporting/executive summaries 🔜(flow over statements engine output — engine shipped today makes this feasible). Voice-to-report ❌(speech APIs + audio pipeline; later).

## 3. AUTOMATION ENGINE (no-code workflows) 🔜
Architecture: /tenants/{id}/workflows docs {trigger, conditions[], actions[]}; executor = Firestore-trigger Cloud Function evaluating rules; UI = builder page (list-based first, drag-drop later). Approvals panel is the seed. Est. 3–4 wks.

## 4. BUSINESS INTELLIGENCE
Executive dashboard 🟡(dashboard exists: revenue/top products/low stock) · Drill-down ✅(exists on charts) · Export PDF/Excel ✅(exists) · Scheduled reports ✅(page exists; delivery needs email) · Forecast-vs-actual 🔜(join Genkit forecast with statements engine).

## 5. COLLABORATION
Presence ✅(shipped, tenant-scoped) · Notifications ✅ · Activity feed ✅ · Task assignments/project boards ✅(projects+tasks exist) · Internal chat/comments/mentions/shared notes/file sharing 🔜(chat = messages subcollection + presence reuse; files need Firebase Storage rules).

## 6. MOBILE
Responsive ✅ SHIPPED (mobile-first CSS layer) · Barcode scanner ✅(exists, camera-based) · Camera uploads ✅(logo/file inputs) · PWA 🔜(manifest.json + next-pwa service worker — 1 day) · Offline mode 🟡(Firestore offline cache + our offline banner; full offline queue later) · Push notifications 🔜(FCM + service worker) · GPS attendance 🔜(geolocation on clock-in) · Digital signatures 🔜(§1).

## 7. ENTERPRISE
Multi-tenancy ✅ SHIPPED · Multi-currency ✅ · Branch mgmt ✅(stores) · Approval chains 🟡(panel exists; chains = §3 engine) · Audit trail ✅(server-side function) · RBAC ✅ + Custom Role Builder ✅ · Multi-company 🔜(§1) · Multi-language 🔜(next-intl; extract strings — biggest lift is string extraction across 54 pages) · Dept hierarchy 🔜(parentId on a departments collection) · Soft deletes 🔜(deletedAt field + filter in hook — one hook change) · Data retention 🔜(scheduled purge function) · SSO/LDAP 🔜(Firebase supports SAML/OIDC on Identity Platform — console config + login button) · 2FA 📦(Firebase MFA — console enable + enrollment UI).

## 8. DEVELOPER PLATFORM
REST API 🔜(Part A #8) · GraphQL ❌(REST first; GraphQL only if integrators demand) · Webhooks 🔜(workflow engine action type) · SDKs/CLI/plugin marketplace ❌(post-API, needs adoption first) · API docs 🔜(OpenAPI with the REST API).

## 9. SECURITY
RBAC ✅ · Audit logs ✅ · Encryption at rest ✅(Firestore default) · Secrets ✅ · Rate limiting ✅ · Session mgmt ✅ · Field-level permissions 🔜(rules can gate diff().affectedKeys() per role — pattern already used on tenant doc) · Row-level security ✅(storeId scoping + tenant paths) · IP restrictions/device mgmt ❌(needs Identity Platform premium / proxy layer) · Login history 🔜(loginRateLimit function already writes attempts — add a viewer page).

## 10. PORTALS 🔜
Architecture: new 'customer'/'vendor' claim roles + portal route group reading only their own docs (rules: `resource.data.customerId == token.portalId`). Reuses invoice templates for statements. Est. 2–3 wks each.

## 11. INTEGRATIONS — ❌ ALL need your provider accounts first
Stripe/PayPal, banking APIs, shipping, tax services, email/SMS/WhatsApp, MS365/Google Workspace, OAuth/SSO/LDAP. Each follows: credential in Secret Manager → Cloud Function adapter → workflow-engine action. None are code-blocked; all are account-blocked.

## 12. ANALYTICS
Sales trends ✅ · Inventory movement ✅ · User activity ✅(logs) · CLV/churn/product profitability/supplier performance/employee KPIs 🔜(each = one computed report page over existing collections; profitability needs cost field — exists).

## 13. INDUSTRY MODULES ✅ FOUNDATION SHIPPED
Industry templates (retail/manufacturing/services/distribution/general) drive module allowance at tenant creation. Deep vertical modules (healthcare, construction…) 🔜 = new module groups on the same allowance mechanism.

## 14. UX
Command palette ✅(exists) · Dark mode ✅(exists) · Table density ✅(exists) · Empty states ✅(component exists) · Keyboard shortcuts 🟡(palette only) · Universal search 🔜(palette + Firestore queries across collections) · Saved views/favorites/drag-drop dashboards/custom widgets/onboarding tours 🔜(saved views = filters JSON per user; tours = driver.js).

## 15. ADVANCED
Real-time notifications ✅(Firestore realtime) · Background jobs ✅(Cloud Functions) · DMS/e-signatures/rule engine/workflow versioning 🔜(rule engine = §3) · Event sourcing ❌(auditTrail gives the benefit without the rewrite) · Data warehouse 🔜(Firebase→BigQuery extension, one-click) · Advanced scheduler 🔜(Cloud Scheduler) · Predictive maintenance/IoT/digital twins ❌(requires hardware + a real manufacturing client to specify).

═══════════════════════════════════════════
SHIPPED THIS SESSION (verified: typecheck ✓ · lint 0 ✓ · 22/22 tests ✓ · build ✓)
═══════════════════════════════════════════
✅ Financial Statements module (P&L / Balance Sheet / Cash Flow) + engine + 5 tests + nav
✅ Account auto-classification (explicit map + keyword heuristics)
✅ Cloud Function ledger schema corrected to real LedgerEntry shape
✅ Logo upload validation (type allowlist + 512KB cap)
✅ firestore.indexes.json (6 composite indexes, deploy-ready)
✅ docs/ARCHITECTURE.md (mermaid system diagram + trust boundaries)

═══════════════════════════════════════════
THE HONEST BOTTOM LINE
═══════════════════════════════════════════
Your wishlist ≈ 200+ features ≈ Odoo's ~15 years of development. Status math:
~45 items ✅ shipped/existing · ~10 📦 deploy-ready · ~110 🔜 planned with architecture · ~15 ❌ blocked on accounts/hardware/stage.
Nothing is unaccounted for. The critical path order: deploy functions+rules+indexes → wire server posting → PWA manifest → NL assistant + OCR (cheap wins on existing Genkit) → workflow engine → portals → REST API → integrations as accounts arrive.
