# CZiumERP — Production Deployment Guide

## Prerequisites
- Node.js 20+
- One shared Firebase project hosts all tenants (clients). Each client is a `/tenants/{tenantId}` document with its data in subcollections underneath — you do **not** create a new Firebase project per client. A separate project per *environment* (staging vs. production) is still the right call.

## 1. Firebase project setup
1. Create the project at console.firebase.google.com.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Enable **Cloud Firestore** (production mode).
4. Deploy the security rules in this repo:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```
   The rules are deny-by-default and require `tenantId` and `role` custom claims on every user (plus an optional `superAdmin` claim for platform operators). Every business document lives under `/tenants/{tenantId}/...`, and the rules require the caller's `tenantId` claim to match the path segment, so cross-tenant access is impossible by structure. Nothing is readable or writable without authentication.

## 2. Provision a tenant and its users
Passwords live only in Firebase Auth — never in code or Firestore.

1. Firebase console → Project settings → Service accounts → **Generate new private key** → save as `serviceAccountKey.json` in the repo root (git-ignored).
2. `npm install firebase-admin --no-save`
3. Create the tenant's `/tenants/{tenantId}` document (via the in-app super-admin console, or by approving a `registrationRequests` entry submitted from `/register`) before provisioning users — the rules check `tenants/{tenantId}.status == 'active'`.
4. Create the first admin for that tenant:
   ```bash
   node scripts/manage-auth-users.mjs create admin@yourclient.com 'StrongPass!234' admin --tenant yourTenantId "Admin User"
   ```
5. Each user also needs a profile document at `/tenants/{tenantId}/users/{uid}` with a matching email — signed-in users can self-heal their own profile doc, or an admin can create it from the in-app Users page.

Other commands: `setrole`, `settenant`, `superadmin` (grants cross-tenant platform access), `setpass`, `disable`, `list` — see the script header.

## 3. Environment configuration
Copy `.env.example` to `.env.local` and fill in the Firebase web config (console → Project settings → Your apps). `GOOGLE_GENAI_API_KEY` is server-side only for the Genkit AI flows — never prefix it with `NEXT_PUBLIC_`.

## 4. Build & deploy
```bash
npm ci
npm run typecheck && npm run lint && npm run test
npm run build
```
Deploy via Firebase App Hosting (`apphosting.yaml` is included) or any Node host running `npm start`. Set the env vars in the hosting provider's secret manager, not in files.

## 5. CI/CD
`.github/workflows/ci.yml` runs on every push/PR: typecheck, lint, unit tests, a plaintext-password guard, an open-Firestore-rules guard, and a production build. Enable branch protection on `main` requiring the `quality` check.

## 6. Backups
Set up scheduled Firestore exports (requires Blaze plan):
```bash
gcloud firestore export gs://YOUR_BACKUP_BUCKET --project YOUR_PROJECT_ID
```
Schedule daily via Cloud Scheduler; retain 30 days; test a restore before go-live.

## Security model summary
| Layer | Enforcement |
|---|---|
| Identity | Firebase Auth (email/password), sessions revocable via admin script |
| Multi-tenancy | Every document lives under `/tenants/{tenantId}/...`; rules require the caller's `tenantId` claim to match the path. Platform operators carry a `superAdmin` claim for cross-tenant access |
| Authorization | Firestore rules read the `role` custom claim: admin / manager / cashier / inventory-staff |
| Finance | Ledger entries append-only for managers; corrections admin-only; activity logs immutable |
| HR | Salary/leave collections restricted to manager+ |
| Client UI | RBAC in `src/lib/rbac.ts` controls what renders (UX only — real enforcement is in the rules) |
| Transport | HSTS, X-Frame-Options DENY, nosniff headers set in `next.config.ts` |

## Known limitations (roadmap items)
- Business invariants (debits = credits, non-negative stock, document numbering) are computed client-side; move posting flows to Cloud Functions for hard server-side enforcement.
- List views subscribe to full collections within a tenant; add pagination before a single tenant's dataset exceeds ~10k documents per collection.
- Password resets for existing users require the admin script or Firebase console (client SDK cannot change another user's password by design).
