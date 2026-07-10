# CZiumERP — Production Deployment Guide

## Prerequisites
- Node.js 20+
- A dedicated Firebase project per environment (staging, production). Never share a project between clients or environments.

## 1. Firebase project setup
1. Create the project at console.firebase.google.com.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Enable **Cloud Firestore** (production mode).
4. Deploy the security rules in this repo:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```
   The rules are deny-by-default and require a `role` custom claim on every user. Nothing is readable or writable without authentication.

## 2. Provision users
Passwords live only in Firebase Auth — never in code or Firestore.

1. Firebase console → Project settings → Service accounts → **Generate new private key** → save as `serviceAccountKey.json` in the repo root (git-ignored).
2. `npm install firebase-admin --no-save`
3. Create the first admin:
   ```bash
   node scripts/manage-auth-users.mjs create admin@yourclient.com 'StrongPass!234' admin "Admin User"
   ```
4. Each user also needs a profile document in the `users` Firestore collection with a matching email (the admin can create these from the in-app Users page after signing in).

Other commands: `setrole`, `setpass`, `disable`, `list` — see the script header.

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
| Authorization | Firestore rules read the `role` custom claim: admin / manager / cashier / inventory-staff |
| Finance | Ledger entries append-only for managers; corrections admin-only; activity logs immutable |
| HR | Salary/leave collections restricted to manager+ |
| Client UI | RBAC in `src/lib/rbac.ts` controls what renders (UX only — real enforcement is in the rules) |
| Transport | HSTS, X-Frame-Options DENY, nosniff headers set in `next.config.ts` |

## Known limitations (roadmap items)
- Business invariants (debits = credits, non-negative stock, document numbering) are computed client-side; move posting flows to Cloud Functions for hard server-side enforcement.
- Data lives in flat top-level collections; multi-tenant isolation is per-Firebase-project (deploy one project per client), not per-tenant-in-one-project.
- List views subscribe to full collections; add pagination before datasets exceed ~10k documents per collection.
- Password resets for existing users require the admin script or Firebase console (client SDK cannot change another user's password by design).
