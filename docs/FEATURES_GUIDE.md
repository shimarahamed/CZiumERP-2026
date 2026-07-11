# CZium ERP — Features Guide

A tour of what CZium can do and how to use each part. For technical/architecture details, see [SOFTWARE_DOCUMENTATION.md](./SOFTWARE_DOCUMENTATION.md).

---

## Getting started

1. **Register / sign in** — go to `/login`. New businesses sign up at `/register`, which creates a registration request for platform approval.
2. **Select a store** — after signing in, most users land on `/select-store` to pick which store/branch they're working in for the session. Admins and managers can also switch to an "All Stores" consolidated view from the header.
3. **Navigate** — the left sidebar groups every module by area (Sales, Inventory, Accounting, HR, etc.). Use the **command palette** (Ctrl/Cmd+K) to jump straight to any page or record by typing its name instead of clicking through menus.
4. **Theme** — toggle light/dark mode from the sun/moon icon in the header. Your choice is remembered for next time; new accounts start in light mode.

---

## Point of Sale (POS)

`/pos` — a fast checkout screen for in-person sales.

- Browse the product grid or scan a barcode to add items to the cart.
- Each product card shows price, stock remaining (or "Service" for non-stock items), and goes red/amber/green depending on how close it is to the reorder threshold.
- Apply per-item or invoice-level discounts, select a customer (or leave as **Walk-in**), and check out.
- **Save as customer**: toggle this switch while on a walk-in sale to capture the buyer's name/phone and save them as a customer record for next time — a popup collects their full details before saving.
- On completion, print or share a receipt immediately.

## Invoicing

`/invoices` — full invoice lifecycle: create, edit, track status (paid / pending / overdue / refunded), and print/export as PDF.

- Item-level discounts (percent or fixed amount per unit) and an invoice-level discount both apply correctly to the grand total, tax, and General Ledger postings.
- Invoices above a configured threshold can require manager/admin **approval** before they post, if your tenant has approval rules turned on.
- **Recurring invoices**: set up a template once and the system automatically generates and sends new invoices on schedule (e.g. monthly retainers).

## Quotations

`/quotations` — draft sales quotes for customers before they commit. Track status (draft / sent / accepted / rejected), and convert an accepted quote directly into an invoice with one click — no re-entering line items.

## Customers, Leads & Campaigns

- **Customers** (`/customers`) — CRM records with loyalty tiers (Bronze/Silver/Gold), loyalty points, and credit limits.
- **Leads** (`/leads`) — a sales pipeline (new → contacted → qualified → won/lost), with AI-assisted company enrichment to fill in details about a lead automatically.
- **Campaigns** (`/campaigns`) — track marketing campaigns by channel, budget, dates, and status.

## Returns & Payments

- **Returns** (`/returns`) — process product/invoice returns and refunds against the original sale.
- **Payments** (`/payments`) — a running view of payment activity across invoices.

## Upselling (AI)

`/upselling` — pick a product and get AI-generated recommendations for complementary items to suggest to the customer, powered by Google Genkit.

## RFQ (Request for Quotation)

`/rfq` — send a request-for-quotation to multiple vendors for the same items and compare their responses side-by-side before committing to a purchase order.

---

## Inventory & Procurement

### Inventory

`/inventory` — the product catalog: prices, cost, stock levels, SKU/barcode, category, and reorder thresholds.

- **Services**: products can be marked as a service (not physically stocked). A service can have **linked products** — components consumed automatically each time the service is performed (e.g. a "installation service" that consumes cables and brackets from stock). Viewing a service's details shows its linked products, their SKUs, and quantity consumed per performance.
- **Tracking modes**: opt individual products into **lot tracking** (batches with expiry dates) or **serial tracking** (one record per physical unit, useful for warranty/serialized goods). Untracked products behave exactly as before — this is additive, not a forced migration.
- **Cycle Count** (`/inventory/cycle-count`) — perform physical stock counts and reconcile counted quantities against what the system expects, generating adjustment entries for variances.

### Purchase Orders

`/purchase-orders` — the procurement lifecycle: pending → approval → ordered → received. Receiving a PO automatically generates a vendor bill in Accounts Payable and updates stock.

### Vendors

`/vendors` — supplier records with performance scorecards (on-time delivery rate, quality rate) to help you evaluate who to buy from.

### Warehouses

`/warehouses` — manage multiple physical locations, each with its own stock levels and bin locations. Every tenant starts with one default warehouse.

### Barcode Scanner

`/scanner` — use your device camera to scan a barcode and instantly look up the matching product.

---

## Manufacturing

- **Bill of Materials** (`/manufacturing/bom`) — define what components (and quantities) go into building a finished product.
- **Production** (`/manufacturing/production`) — schedule and track production orders through planned → in-progress → completed (or on-hold/cancelled), with a production schedule view.
- **Quality** (`/manufacturing/quality`) — run quality inspection checks against production orders and record pass/fail results with inspector notes.

## Shipping & Logistics

- **Shipments** (`/shipping/shipments`) — track deliveries from dispatch through in-transit to delivered, with driver and vehicle assignment.
- **Routes** (`/shipping/routes`) — plan delivery routes.
- **Vehicles** (`/shipping/vehicles`) — manage your delivery fleet.

---

## Accounting & Finance

All accounting pages live under `/accounting/`.

| Page | What it's for |
|---|---|
| **General Ledger** | Browse every double-entry posting across the business |
| **Receivables** | AR aging summary and a list of overdue invoices to chase |
| **Payables** | Manage and pay vendor bills |
| **Budgeting** | Compare budget vs. actuals by category and period (monthly/quarterly/yearly), per store |
| **Tax** | Configure tax rates by jurisdiction, including a tenant-wide default |
| **Reconciliation** | Import a bank statement (CSV) and auto-match transactions against paid invoices |
| **Statements** | Generate Profit & Loss, Balance Sheet, and Cash Flow statements, each with an AI-written plain-English summary |
| **Assets** | Track fixed assets — status (in use / in storage / under maintenance / retired), purchase cost, and assignment |
| **Intercompany** | Post transactions between stores/entities and view a consolidated multi-entity report with Due-to/Due-from balances |

**How discounts flow into accounting**: every invoice discount — whether it's a per-line-item discount or an invoice-level discount — is netted out before the Sales Revenue and tax are calculated, so your General Ledger and financial statements always reflect the true, discounted revenue, not the gross list price.

---

## Human Resources

All HR pages live under `/human-resources/`.

| Page | What it's for |
|---|---|
| **Dashboard** | At-a-glance leave balances, pending approvals, headcount, and today's attendance |
| **Employees** | Full employee records — onboarding through offboarding, identity documents, banking, issued assets, IT accounts, and performance history |
| **Departments** | Build your org hierarchy |
| **Attendance** | Daily present/absent/leave/half-day tracking |
| **Timesheets** | Log hours against projects (managers see the whole team; employees see their own) |
| **Leave Requests** | Submit leave, check your balance, and (for managers) approve team requests |
| **Expenses** | Submit expense claims for approval and reimbursement |
| **Payroll** | Run payroll — gross pay, deductions, and net pay — which posts automatically to the General Ledger |
| **Recruitment** | Manage candidates through a pipeline against open job requisitions, with interview feedback |
| **Jobs** | Create and manage job requisitions (open / on-hold / closed) |
| **Performance** | Record performance reviews with ratings and comments |
| **Settings** | Configure HR lifecycle email templates (e.g. onboarding, offboarding) and view the send log |

---

## Projects & Service Desk

- **Projects** (`/projects`) — track projects with a Gantt-chart timeline, tasks, budgets, and team assignment.
- **Support Tickets** (`/support/tickets`) — an internal helpdesk with priority levels, status tracking, and comment threads.
- **IT Assets** (`/support/it-assets`) — track laptops, accounts, and other IT equipment issued to employees.

---

## Reporting & Analytics

- **Analytics** (`/analytics`) — business dashboards summarizing sales, inventory, and financial trends.
- **Reports → Builder** (`/reports/builder`) — build a custom report by picking a data source, columns, filters, and aggregations, without writing any code.
- **Reports → Scheduled** (`/reports/scheduled`) — have a report automatically generated and delivered on a schedule.
- **AI Assistant** (`/assistant`) — ask plain-English questions about your business data and get an AI-generated answer.

---

## Notifications & Collaboration

- **In-app notifications**: the bell icon in the header shows unread alerts that deep-link straight to the relevant record.
- **Multi-channel alerts**: your tenant can also be configured to send the same kinds of alerts via email, SMS, or WhatsApp — each channel is configured independently in Settings.
- **Presence avatars**: when a teammate is viewing the same record as you, their avatar appears in the header, so you always know who else is looking at what.
- **Activity log** (`/activity`): a full audit trail of who changed what and when, with field-level before/after detail, both per-record and tenant-wide.

---

## Automations

Two things happen automatically in the background, no manual trigger needed:

- **Low-stock reordering**: when a product's stock drops to or below its reorder threshold, the system can trigger a reorder action automatically.
- **Recurring invoices**: any invoice set up as recurring is generated and issued on its schedule without anyone needing to remember to create it.

---

## Settings & Administration

`/settings` and related pages, typically restricted to admins/managers.

- **Company profile & branding**: logo, colors, and document templates used on printed invoices/quotes/POs.
- **Module toggles**: turn entire modules on/off for your tenant depending on what your business needs.
- **Approval rules**: configure which transactions (purchase orders, invoices, leave requests, expense claims, vendor bills, RFQs) require approval, at what dollar threshold, and who approves them.
- **Custom Fields** (`/settings/custom-fields`): add your own fields to customers, products, invoices, etc. without needing custom development.
- **Import** (`/settings/import`): bulk-import data from CSV/Excel.
- **Roles** (`/settings/roles`): build custom roles with fine-tuned permissions beyond the built-in admin/manager/cashier/inventory-staff roles.
- **Users** (`/users`): manage user accounts, their roles, and which store they're assigned to.
- **Stores** (`/stores`): manage store/branch records, each with its own functional currency and tax jurisdiction.

## Platform Administration (Super Admin)

`/super-admin` — for the platform operator managing multiple tenant businesses:

- **Tenants**: view and manage every tenant on the platform.
- **Requests**: approve or reject new business registration requests.
- **Blueprints**: define reusable "industry vertical" templates (module sets, custom fields, terminology) so new tenants of a given business type can be set up instantly.
- **Modules**: control which modules each tenant has access to.
- **Users**: manage platform-level user accounts.
- **System**: platform-wide operational settings.

---

## Integrations

- **REST API**: generate API keys (Settings) to let external systems read/write your CZium data.
- **Webhooks**: subscribe an external URL to events like `invoice.created`, `stock.low`, or `purchase-order.approved`, and CZium will push a signed notification the moment they happen.

---

## Offline & Mobile

CZium is installable as a Progressive Web App (PWA) and keeps working with cached data if your connection drops — an offline banner appears, and sales, invoices, and new customers you add while offline sync automatically once you're back online. Every page is responsive and adapts to phone/tablet screens, including touch-friendly card views for tables and bottom-sheet dialogs on mobile.
