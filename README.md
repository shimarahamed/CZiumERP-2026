# CZium ERP

CZium is a multi-tenant ERP built with Next.js, React, TypeScript, Firebase, and Cloud Functions. It covers sales, invoicing, POS, inventory, purchasing, accounting, HR, service, projects, analytics, and tenant administration.

## Local Development

Install dependencies:

```bash
npm install
npm --prefix functions install
```

Run the web app:

```bash
npm run dev
```

Open:

```text
http://localhost:9002
```

The dev script is pinned to port `9002`:

```bash
next dev --turbopack -p 9002
```

## Verification

Use these before shipping changes:

```bash
npm run typecheck
npm test
npm run build
npm --prefix functions run build
```

## Backend And Security Model

- Firebase Authentication carries the tenant and role claims used by the app and Firestore rules.
- Tenant data is stored under `/tenants/{tenantId}` in Firestore.
- Invoice posting runs through the `postInvoiceWithLedger` callable Function so invoice IDs, ledger entries, stock levels, lots, serials, service-linked inventory, and activity logs update in one backend transaction.
- SMTP, SMS, and WhatsApp sends run through callable Cloud Functions. Browser code no longer posts provider credentials to Next API routes.
- Raw messaging secrets under `smtpConfig`, `smsConfig`, and `whatsappConfig` are readable only by tenant admins in Firestore rules.

## Key Scripts

- `npm run dev` - start the Next.js app on port 9002.
- `npm run typecheck` - run TypeScript checks for the web app.
- `npm test` - run Vitest tests.
- `npm run build` - build the Next.js app.
- `npm --prefix functions run build` - build Firebase Functions.
- `npm run genkit:dev` - start the Genkit development server.

## Deployment Notes

Deploy Firestore rules and Cloud Functions together when changing backend posting or messaging behavior. The web app depends on the callable Functions for invoice posting and tenant messaging.
