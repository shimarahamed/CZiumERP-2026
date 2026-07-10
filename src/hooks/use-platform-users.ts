'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/context/AppContext';
import type { Tenant, User } from '@/types';

export type PlatformUser = User & { tenantId: string; tenantName: string };

/**
 * Every user profile across all tenants — rules grant super admins read
 * access to /tenants/{id}/users, so this needs no Cloud Functions.
 */
export function usePlatformUsers(tenants: Tenant[]) {
  const { isSuperAdmin } = useAppContext();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (tenants.length === 0) { setUsers([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const perTenant = await Promise.all(tenants.map(async (t) => {
          const snap = await getDocs(collection(db, 'tenants', t.id, 'users'));
          return snap.docs.map(d => ({
            ...(d.data() as User),
            id: d.id,
            tenantId: t.id,
            tenantName: t.name,
          }));
        }));
        if (!cancelled) {
          setUsers(perTenant.flat());
          setIsLoaded(true);
        }
      } catch {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isSuperAdmin, tenants]);

  return { users, isLoaded };
}
