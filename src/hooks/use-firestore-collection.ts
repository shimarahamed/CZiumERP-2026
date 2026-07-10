'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, writeBatch, type CollectionReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// Demo seeding is opt-in and must never run against a production tenant.
const SEED_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED === 'true';
const BATCH_LIMIT = 450; // Firestore hard limit is 500 ops per batch

/**
 * Tenant-scoped realtime collection hook.
 *
 * Data lives at /tenants/{tenantId}/{collectionName}. While tenantId is null
 * (pre-login, super-admin session) no subscription is opened and data is empty.
 *
 * Writes are DIFF-BASED: compared against the previous in-memory snapshot,
 * only changed docs are set and only docs the caller actually removed are
 * deleted. The collection is never read back and never bulk-rewritten, so
 * concurrent editors can no longer wipe each other's records.
 */
export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[],
  tenantId: string | null
) {
  const [data, setData] = useState<T[]>(SEED_ENABLED ? initialData : []);
  const [isLoaded, setIsLoaded] = useState(false);
  // Ref mirror of data so setCollection can diff without stale closures
  const dataRef = useRef<T[]>(data);
  dataRef.current = data;

  useEffect(() => {
    if (!tenantId) {
      setData(SEED_ENABLED ? initialData : []);
      setIsLoaded(false);
      return;
    }

    const collRef = collection(db, 'tenants', tenantId, collectionName) as CollectionReference<T>;

    let firstSnapshot = true;
    const unsubscribe = onSnapshot(
      collRef,
      (snapshot) => {
        // One-time demo seed for local/dev environments only
        if (firstSnapshot && SEED_ENABLED && snapshot.empty && initialData.length > 0) {
          const useMockData = typeof window !== 'undefined' ? localStorage.getItem('useMockData') !== 'false' : true;
          if (useMockData) {
            const batch = writeBatch(db);
            initialData.forEach((item) => {
              if (item.id && typeof item.id === 'string') {
                batch.set(doc(db, 'tenants', tenantId, collectionName, item.id), stripUndefined(item as object));
              }
            });
            batch.commit().catch((error) => {
              console.error(`Error seeding demo data for ${collectionName}:`, error);
            });
          }
        }
        firstSnapshot = false;
        const newData = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
        setData(newData);
        setIsLoaded(true);
      },
      (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
        errorEmitter.emit('permission-error', { error, collectionName, attemptedData: null });
        setIsLoaded(true); // Unblock UI even on error
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, tenantId]);

  const setCollection = useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      if (!tenantId) {
        console.error(`[Firestore] Write to "${collectionName}" ignored: no tenant selected.`);
        return;
      }
      const previousData = dataRef.current;
      const newData = typeof updater === 'function' ? updater(previousData) : updater;
      // Sync the ref immediately so a second setCollection call in the same
      // tick diffs against this update instead of the stale pre-update state.
      dataRef.current = newData;
      setData(newData); // Optimistic update

      (async () => {
        try {
          // Diff previous vs new — touch only what actually changed.
          const prevById = new Map(previousData.map(item => [item.id, item]));
          const newIds = new Set<string>();
          type Op = { type: 'set'; id: string; item: T } | { type: 'delete'; id: string };
          const ops: Op[] = [];

          for (const item of newData) {
            if (typeof item.id !== 'string' || item.id.trim() === '') {
              console.error(`[Firestore] Skipped write for item with invalid ID in "${collectionName}":`, item);
              continue;
            }
            newIds.add(item.id);
            const prev = prevById.get(item.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
              ops.push({ type: 'set', id: item.id, item });
            }
          }
          // Delete only docs this client previously had and explicitly removed
          for (const prev of previousData) {
            if (!newIds.has(prev.id)) ops.push({ type: 'delete', id: prev.id });
          }

          for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            for (const op of ops.slice(i, i + BATCH_LIMIT)) {
              const docRef = doc(db, 'tenants', tenantId, collectionName, op.id);
              if (op.type === 'set') {
                batch.set(docRef, stripUndefined(op.item as object), { merge: true });
              } else {
                batch.delete(docRef);
              }
            }
            await batch.commit();
          }
        } catch (error: unknown) {
          console.error(`Firestore update failed for collection: ${collectionName}`, { error });
          dataRef.current = previousData;
          setData(previousData); // Roll back optimistic update
          errorEmitter.emit('rollback', { collectionName });
          errorEmitter.emit('permission-error', { error, collectionName, attemptedData: newData });
        }
      })();
    },
    [collectionName, tenantId]
  );

  return [data, setCollection, isLoaded] as const;
}
