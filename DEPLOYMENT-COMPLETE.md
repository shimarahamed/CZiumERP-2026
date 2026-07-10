# CZiumERP — Complete Deployment Guide

Follow these steps in order. Assumes a fresh machine and a Google account.

## 0. Prerequisites
```bash
node -v            # must be >= 20
npm i -g firebase-tools
firebase login
```

## 1. Create the Firebase project
1. https://console.firebase.google.com → **Add project** (e.g. `czium-prod`).
2. Upgrade to the **Blaze plan** (required for Cloud Functions, backups, outbound calls).
3. **Authentication → Get started → Email/Password → Enable.**
4. **Firestore Database → Create database → Production mode →** pick a region.
5. **Project settings → Your apps → Web app (`</>`)** → register → copy the config.

## 2. Configure the app
```bash
cd czium
cp .env.example .env.local
```
Fill `.env.local` with the web config, plus `GOOGLE_GENAI_API_KEY` from
https://aistudio.google.com/apikey (for AI features). Leave
`NEXT_PUBLIC_ENABLE_DEMO_SEED` unset in production.

## 3. Deploy rules + indexes
```bash
firebase use --add          # select czium-prod
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 4. Deploy Cloud Functions
```bash
cd functions && npm install && npm run build && firebase deploy --only functions && cd ..
```
Deploys: inviteUser, postInvoiceWithLedger, auditTrail, loginRateLimit, setUserClaims.

## 5. Create the first super admin
```bash
# Project settings → Service accounts → Generate new private key → save as serviceAccountKey.json
npm install firebase-admin --no-save
node scripts/manage-auth-users.mjs create ops@yourco.com 'Str0ngPass!' admin --tenant bootstrap
node scripts/manage-auth-users.mjs superadmin ops@yourco.com
```

## 6. Build & deploy the web app
Firebase App Hosting (config in apphosting.yaml):
```bash
firebase deploy --only apphosting
# Set env vars as secrets in the App Hosting backend (console), not in files.
```
Or any Node host: `npm ci && npm run build && npm start`

## 7. First run
1. Sign in as ops@yourco.com → lands on /super-admin.
2. Create a tenant (industry template auto-enables modules).
3. `node scripts/manage-auth-users.mjs create admin@client.com 'Pass!1' admin --tenant <slug> "Admin"`
4. Tenant admin signs in → invites staff, sets branding/modules/roles.

## 8. 2FA
Console → Authentication → Sign-in method → SMS/TOTP multi-factor.

## 9. Daily backups
```bash
gsutil mb -l <region> gs://czium-prod-backups
gsutil lifecycle set <(echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}') gs://czium-prod-backups
# Cloud Scheduler → run scripts/backup-firestore.sh czium-prod daily
```

## 10. Migrate existing single-tenant data (upgrades only)
```bash
node scripts/migrate-to-tenant.mjs <slug> --dry-run
node scripts/migrate-to-tenant.mjs <slug>
node scripts/manage-auth-users.mjs settenant user@client.com <slug>
# verify, then:
node scripts/migrate-to-tenant.mjs <slug> --delete-source
```

## Post-deploy verification
- [ ] Super admin can create a tenant
- [ ] Tenant admin can invite a user + toggle modules
- [ ] Invited user sees only enabled modules
- [ ] Invoice prints with chosen template + logo
- [ ] /accounting/statements shows P&L
- [ ] /analytics + /assistant load (assistant needs GENAI key)
- [ ] Tenant B cannot see Tenant A's data
- [ ] Offline banner appears when network is killed

## Troubleshooting
- "Missing or insufficient permissions" → rules not deployed or `tenantId` claim missing (`manage-auth-users.mjs list`).
- AI fails → GOOGLE_GENAI_API_KEY not set server-side.
- In-app user creation fails → functions not deployed (use the create script).
- Claim change not applied → user must sign out/in (script revokes tokens).
