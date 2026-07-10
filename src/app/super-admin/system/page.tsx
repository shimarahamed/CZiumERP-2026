'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type SuperAdminRecord = { id: string; email?: string | null };
type FunctionsStatus = 'unknown' | 'checking' | 'available' | 'unavailable';

const FUNCTION_CAPABILITIES = [
  { name: 'inviteUser', purpose: 'In-app user invites (accounts + claims + profile in one step)' },
  { name: 'postInvoiceWithLedger', purpose: 'Server-validated invoice posting (atomic GL + stock)' },
  { name: 'auditTrail', purpose: 'Tamper-proof mirror of business-data writes' },
  { name: 'loginRateLimit', purpose: 'Refresh-proof brute-force lockout' },
  { name: 'setUserClaims', purpose: 'Role/claim changes from the console' },
  { name: 'superAdmin* data & password functions', purpose: 'Cross-tenant record browser and password resets' },
];

export default function SuperAdminSystemPage() {
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRecord[]>([]);
  const [fnStatus, setFnStatus] = useState<FunctionsStatus>('unknown');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'superAdmins'), (snap) => {
      setSuperAdmins(snap.docs.map(d => ({ id: d.id, ...(d.data() as { email?: string | null }) })));
    }, () => { /* collection may be empty/unreadable pre-functions */ });
    return () => unsub();
  }, []);

  const checkFunctions = async () => {
    setFnStatus('checking');
    try {
      // Deliberately invalid payload: a deployed function answers
      // 'invalid-argument'; an undeployed one answers 'not-found'.
      await httpsCallable(getFunctions(app), 'superAdminListTenantUsers')({});
      setFnStatus('available');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setFnStatus(code.includes('invalid-argument') || code.includes('permission-denied') ? 'available' : 'unavailable');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cloud Functions</CardTitle>
          <CardDescription>
            Server-side capabilities require the Blaze plan and a functions deploy
            (firebase deploy --only functions). Everything else in this console works without them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={checkFunctions} disabled={fnStatus === 'checking'}>
              {fnStatus === 'checking' ? 'Checking…' : 'Check availability'}
            </Button>
            {fnStatus === 'available' && <Badge>Functions deployed</Badge>}
            {fnStatus === 'unavailable' && <Badge variant="destructive">Not deployed</Badge>}
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Function</TableHead><TableHead>Unlocks</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {FUNCTION_CAPABILITIES.map(f => (
                <TableRow key={f.name}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{f.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform operators</CardTitle>
          <CardDescription>
            Accounts holding the superAdmin claim. This list is maintained by the setUserClaims function;
            operators granted via the script appear once that function has run for them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {superAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No records yet — grant or refresh an operator with: node scripts/manage-auth-users.mjs superadmin &lt;email&gt;
            </p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>UID</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
              <TableBody>
                {superAdmins.map(sa => (
                  <TableRow key={sa.id}>
                    <TableCell className="font-mono text-xs">{sa.id}</TableCell>
                    <TableCell className="text-sm">{sa.email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provisioning reference</CardTitle>
          <CardDescription>Terminal commands for account operations that need the Admin SDK.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto leading-relaxed">
{`# Create a tenant user (admin | manager | cashier | inventory-staff)
node scripts/manage-auth-users.mjs create <email> <password> <role> --tenant <tenant-id> "<Display Name>"

# Change a user's role / move to another tenant
node scripts/manage-auth-users.mjs setrole <email> <role> [--tenant <tenant-id>]
node scripts/manage-auth-users.mjs settenant <email> <tenant-id>

# Grant platform-operator access
node scripts/manage-auth-users.mjs superadmin <email>

# List all accounts with their claims
node scripts/manage-auth-users.mjs list`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
