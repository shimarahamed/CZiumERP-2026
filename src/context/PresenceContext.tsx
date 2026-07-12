'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import type { PresenceRecord, Role } from '@/types';
import { useAppContext } from './AppContext';

const PRESENCE_TTL_MS = 30_000; // 30s — purge stale
const HEARTBEAT_INTERVAL_MS = 10_000;

// Visibility follows the role hierarchy: admin sees everyone, manager sees
// cashier/inventory-staff (and other managers), cashier/inventory-staff only
// see peers at their own level — never manager or admin.
const VISIBLE_ROLES: Record<Role, Role[]> = {
  admin: ['admin', 'manager', 'cashier', 'inventory-staff'],
  manager: ['manager', 'cashier', 'inventory-staff'],
  cashier: ['cashier', 'inventory-staff'],
  'inventory-staff': ['cashier', 'inventory-staff'],
};

function canSeeRole(viewerRole: Role | undefined, targetRole: Role): boolean {
  if (!viewerRole) return false;
  return VISIBLE_ROLES[viewerRole].includes(targetRole);
}

interface PresenceContextType {
  presentUsers: PresenceRecord[];
  usersOnRoute: (route: string) => PresenceRecord[];
  usersOnRecord: (route: string, recordId: string) => PresenceRecord[];
  setViewingRecord: (recordId: string | null) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, tenantId } = useAppContext();
  const pathname = usePathname();
  const [presentUsers, setPresentUsers] = useState<PresenceRecord[]>([]);
  const recordIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const presenceDocId = user ? `presence-${user.id}` : null;

  const writePresence = useCallback(async () => {
    if (!user || !presenceDocId || !tenantId) return;
    const record: PresenceRecord = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar ?? '',
      role: user.role,
      route: pathname,
      ...(recordIdRef.current && { recordId: recordIdRef.current }),
      lastSeen: Date.now(),
    };
    try {
      await setDoc(doc(db, 'tenants', tenantId, 'presence', presenceDocId), record);
    } catch (err) {
      console.warn('[Presence] Failed to write presence record:', err);
    }
  }, [user, presenceDocId, pathname, tenantId]);

  const clearPresence = useCallback(async () => {
    if (!presenceDocId || !tenantId) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'presence', presenceDocId));
    } catch (err) {
      console.warn('[Presence] Failed to clear presence record:', err);
    }
  }, [presenceDocId, tenantId]);

  // Heartbeat
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    writePresence();
    heartbeatRef.current = setInterval(writePresence, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      clearPresence();
    };
  }, [isAuthenticated, user, writePresence, clearPresence]);

  // Re-write when route changes
  useEffect(() => {
    if (isAuthenticated && user) writePresence();
  }, [pathname, isAuthenticated, user, writePresence]);

  // Listen to all presence docs
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;
    const unsub = onSnapshot(collection(db, 'tenants', tenantId, 'presence'), (snap) => {
      const now = Date.now();
      const fresh: PresenceRecord[] = [];
      snap.forEach(d => {
        const r = d.data() as PresenceRecord;
        if (now - r.lastSeen < PRESENCE_TTL_MS) fresh.push(r);
      });
      setPresentUsers(fresh);
    });
    return unsub;
  }, [isAuthenticated, tenantId]);

  const usersOnRoute = useCallback(
    (route: string) =>
      presentUsers.filter(
        u => u.route === route && u.userId !== user?.id && canSeeRole(user?.role, u.role)
      ),
    [presentUsers, user]
  );

  const usersOnRecord = useCallback(
    (route: string, recordId: string) =>
      presentUsers.filter(
        u =>
          u.route === route &&
          u.recordId === recordId &&
          u.userId !== user?.id &&
          canSeeRole(user?.role, u.role)
      ),
    [presentUsers, user]
  );

  const setViewingRecord = useCallback((recordId: string | null) => {
    recordIdRef.current = recordId;
    writePresence();
  }, [writePresence]);

  return (
    <PresenceContext.Provider value={{ presentUsers, usersOnRoute, usersOnRecord, setViewingRecord }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
}
