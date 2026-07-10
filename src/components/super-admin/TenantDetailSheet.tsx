'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Tenant, User, Role, IndustryTemplate } from '@/types';

const ROLES: Role[] = ['admin', 'manager', 'cashier', 'inventory-staff'];

const BUSINESS_COLLECTIONS = [
  'vendors', 'products', 'invoices', 'customers', 'purchaseOrders',
  'employees', 'ledgerEntries', 'projects', 'tickets', 'shipments',
] as const;

type TenantUser = User & { id: string };

type SuperAdminListCollectionResult = { docs: Record<string, unknown>[] };

export function TenantDetailSheet({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [collectionName, setCollectionName] = useState<string>('vendors');
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<TenantUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePlan, setProfilePlan] = useState('standard');
  const [profileIndustry, setProfileIndustry] = useState<IndustryTemplate>('general');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (open && tenant) {
      setProfileName(tenant.name);
      setProfilePlan(tenant.plan ?? 'standard');
      setProfileIndustry(tenant.industry ?? 'general');
    }
  }, [open, tenant]);

  const saveProfile = async () => {
    if (!tenant || !profileName.trim()) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'tenants', tenant.id), {
        name: profileName.trim(),
        plan: profilePlan,
        industry: profileIndustry,
      });
      await setDoc(doc(db, 'tenantDirectory', tenant.id), {
        name: profileName.trim(),
        plan: profilePlan,
      }, { merge: true });
      toast({ title: 'Tenant profile saved', description: profileName.trim() });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Rules already grant superAdmin read access to /tenants/{id}/users, so this
  // reads live via Firestore directly — it works with no Cloud Functions.
  useEffect(() => {
    if (!open || !tenant) return;
    setLoadingUsers(true);
    const unsub = onSnapshot(
      collection(db, 'tenants', tenant.id, 'users'),
      (snap) => {
        setUsers(snap.docs.map(d => ({ ...(d.data() as User), id: d.id })));
        setLoadingUsers(false);
      },
      () => {
        toast({ variant: 'destructive', title: 'Could not load users' });
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, [open, tenant, toast]);

  const loadDocs = useCallback(async () => {
    if (!tenant) return;
    setLoadingDocs(true);
    try {
      const call = httpsCallable(getFunctions(app), 'superAdminListCollection');
      const res = await call({ tenantId: tenant.id, collection: collectionName });
      setDocs((res.data as SuperAdminListCollectionResult).docs ?? []);
    } catch {
      toast({ variant: 'destructive', title: 'Could not load data', description: 'Cloud Functions may not be deployed yet.' });
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [tenant, collectionName, toast]);

  useEffect(() => {
    if (open && tenant) {
      loadDocs();
    }
  }, [open, tenant, loadDocs]);

  const changeRole = async (targetUser: TenantUser, role: Role) => {
    if (!tenant) return;
    try {
      // Claims are the authoritative permission source (rules check the JWT,
      // not this doc), but the user must sign out/in to pick up a new claim.
      // Cloud Function keeps claims + profile doc in sync in one call when
      // deployed; falls back to updating just the profile doc otherwise so
      // the console still reflects the change immediately.
      try {
        const call = httpsCallable(getFunctions(app), 'setUserClaims');
        await call({ uid: targetUser.id, tenantId: tenant.id, role });
      } catch {
        await updateDoc(doc(db, 'tenants', tenant.id, 'users', targetUser.id), { role });
        toast({ title: 'Profile role updated', description: 'Cloud Functions unavailable — the sign-in claim was not changed, so this user must be updated with scripts/manage-auth-users.mjs setrole to actually change their access.' });
        return;
      }
      toast({ title: 'Role updated', description: `${targetUser.name} is now ${role}. They must sign out and back in.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update role' });
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!tenant) return;
    try {
      const call = httpsCallable(getFunctions(app), 'superAdminDeleteDocument');
      await call({ tenantId: tenant.id, collection: collectionName, docId });
      toast({ title: 'Record deleted' });
      loadDocs();
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete record' });
    }
  };

  const submitPasswordReset = async () => {
    if (!passwordTarget || newPassword.length < 8) return;
    setSavingPassword(true);
    try {
      const call = httpsCallable(getFunctions(app), 'superAdminSetUserPassword');
      await call({ uid: passwordTarget.id, newPassword });
      toast({ title: 'Password updated', description: `${passwordTarget.name}'s password was reset.` });
      setPasswordTarget(null);
      setNewPassword('');
    } catch {
      toast({ variant: 'destructive', title: 'Could not reset password' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!tenant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{tenant.name}</SheetTitle>
          <SheetDescription>
            <span className="font-mono">{tenant.id}</span> · <span className="capitalize">{tenant.blueprintId ?? tenant.industry ?? '—'}</span> ·{' '}
            <Badge variant={tenant.status === 'active' ? 'default' : 'destructive'}>{tenant.status}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>Plan: {tenant.plan ?? 'standard'}</p>
          <p>Created: {tenant.createdAt}</p>
          <p>Allowed modules: {tenant.allowedModules?.join(', ') || '—'}</p>
          <p>Enabled modules: {tenant.enabledModules?.join(', ') || '—'}</p>
        </div>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="data">Business data</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="tp-name">Company name</Label>
                <Input id="tp-name" value={profileName} onChange={e => setProfileName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={profilePlan} onValueChange={setProfilePlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Industry template</Label>
                <Select value={profileIndustry} onValueChange={(v) => setProfileIndustry(v as IndustryTemplate)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail / POS</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="services">Professional services</SelectItem>
                    <SelectItem value="distribution">Distribution</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button size="sm" onClick={saveProfile} disabled={savingProfile || !profileName.trim()}>
                  {savingProfile ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Module allowances are managed on the Modules page; suspend/reactivate from the tenants list.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            {passwordTarget && (
              <div className="border rounded-md p-3 space-y-2">
                <Label>Reset password for {passwordTarget.name}</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                  />
                  <Button size="sm" onClick={submitPasswordReset} disabled={savingPassword || newPassword.length < 8}>
                    {savingPassword ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setPasswordTarget(null); setNewPassword(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No users in this tenant yet.</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => changeRole(u, v as Role)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setPasswordTarget(u)}>Reset password</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="data" className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Collection</Label>
              <Select value={collectionName} onValueChange={setCollectionName}>
                <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_COLLECTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={loadDocs} disabled={loadingDocs}>
                {loadingDocs ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Raw record editor for support/ops use — bypasses normal business rules (e.g. does not adjust stock or post ledger entries). Use the regular tenant app for everyday transactions.
            </div>
            <div className="border rounded-md overflow-auto max-h-96">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {docs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No records.</TableCell></TableRow>
                  ) : docs.map((d) => (
                    <TableRow key={d.id as string}>
                      <TableCell className="font-mono text-xs align-top">{d.id as string}</TableCell>
                      <TableCell className="text-xs align-top">
                        <pre className="whitespace-pre-wrap break-all max-w-md">{JSON.stringify(d, null, 2)}</pre>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button size="sm" variant="destructive" onClick={() => deleteDoc(d.id as string)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
