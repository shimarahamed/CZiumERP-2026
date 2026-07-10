'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/context/AppContext';
import type { Tenant, RegistrationRequest, VerticalBlueprint } from '@/types';

/** Live platform-level data for the super-admin console. */
export function usePlatformData() {
  const { isSuperAdmin } = useAppContext();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [blueprints, setBlueprints] = useState<VerticalBlueprint[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubTenants = onSnapshot(collection(db, 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => ({ ...(d.data() as Tenant), id: d.id })));
      setIsLoaded(true);
    }, () => setIsLoaded(true));
    const unsubReqs = onSnapshot(collection(db, 'registrationRequests'), (snap) => {
      setRequests(snap.docs.map(d => ({ ...(d.data() as RegistrationRequest), id: d.id })));
    }, () => { /* requests are optional */ });
    const unsubBlueprints = onSnapshot(collection(db, 'verticalBlueprints'), (snap) => {
      setBlueprints(snap.docs.map(d => ({ ...(d.data() as VerticalBlueprint), id: d.id })));
    }, () => { /* blueprints are optional until seeded */ });
    return () => { unsubTenants(); unsubReqs(); unsubBlueprints(); };
  }, [isSuperAdmin]);

  return { tenants, requests, blueprints, isLoaded };
}
