# CZiumERP — System Architecture

```mermaid
flowchart TB
    subgraph Clients["Clients (mobile-first responsive)"]
        B["Browser / PWA-ready<br/>Next.js 15 App Router · React 18 · shadcn/Radix"]
    end

    subgraph Identity["Identity"]
        FA["Firebase Auth<br/>email+password · email verification<br/>custom claims: tenantId · role · superAdmin"]
    end

    subgraph App["Application layer (client)"]
        CTX["AppContext<br/>session · theme · module toggles"]
        HOOK["use-firestore-collection<br/>tenant-scoped realtime reads<br/>diff-based per-doc writes"]
        LIBS["libs: money (integer cents) ·<br/>financial-statements · palettes ·<br/>document-number · posting"]
    end

    subgraph Server["Server layer (Cloud Functions v2)"]
        F1["inviteUser<br/>(accounts + claims + profile)"]
        F2["postInvoiceWithLedger<br/>(atomic: invoice + balanced GL + stock)"]
        F3["auditTrail trigger<br/>(tamper-proof write mirror)"]
        F4["loginRateLimit<br/>(refresh-proof brute-force counter)"]
        F5["setUserClaims<br/>(super-admin management)"]
    end

    subgraph Data["Firestore (rules: deny-by-default, tenant-scoped)"]
        T1["/tenants/{id}/…<br/>35 business collections<br/>settings · users · counters · roles · auditTrail"]
        T2["/tenantDirectory · /registrationRequests<br/>/superAdmins · /loginAttempts"]
    end

    subgraph AI["AI (Genkit + Google AI)"]
        G["flows: sales forecast · lead enrichment ·<br/>upsell · ticket analysis · routing"]
    end

    subgraph Ops["Ops"]
        CI["GitHub Actions CI<br/>typecheck · lint · 22 tests ·<br/>secret & rules guards · build"]
        BK["backup-firestore.sh → GCS<br/>30-day lifecycle"]
        SCR["scripts: manage-auth-users ·<br/>migrate-to-tenant"]
    end

    B -->|sign in| FA
    FA -->|ID token + claims| B
    B --> CTX --> HOOK
    HOOK -->|"/tenants/{claims.tenantId}/…"| T1
    B -->|callable| F1 & F2 & F4
    F1 & F2 & F5 --> T1
    F3 --> T1
    F4 --> T2
    B -->|register org| T2
    B --> G
    SCR --> FA
    SCR --> T1
    BK --> Data
```

## Data flow (happy path)
1. User signs in → Firebase Auth returns an ID token carrying `tenantId` + `role` claims.
2. Every read/write goes to `/tenants/{tenantId}/…`; security rules verify the claim
   matches the path segment — cross-tenant access is structurally impossible.
3. Writes are optimistic in the UI, diffed against the previous snapshot, and
   committed as per-document batched operations (never a full-collection rewrite).
4. Cloud Functions handle what clients must not: account provisioning, claims,
   transactional posting with balanced-ledger + stock invariants, tamper-proof audit.
5. Super admins bypass tenant scoping via the `superAdmin` claim and operate the
   platform from `/super-admin`.

## Trust boundaries
- **Client** is untrusted: rules + functions enforce everything that matters.
- **Claims** are the only identity source; profile docs are display data.
- **auditTrail** and **activityLogs** are write-locked against clients.
