'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportRollup } from '@/types';

/**
 * Reads pre-aggregated daily ReportRollup docs for the last `days` days — the fast
 * path for dashboard trend charts, avoiding a live scan over every invoice ever
 * created. storeId undefined reads the tenant-wide rollup ('all'); "today" is never
 * included since it hasn't been rolled up yet (computeRollups runs once daily for
 * the prior day) — callers wanting today's number should combine this with a live
 * computation from src/lib/analytics.ts.
 */
export function useReportRollups(tenantId: string | null, storeId: string | undefined, days: number) {
  const [rollups, setRollups] = useState<ReportRollup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) { setRollups([]); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const ref = collection(db, 'tenants', tenantId, 'reportRollups');
    const q = query(ref, where('storeId', '==', storeId ?? null), where('date', '>=', cutoff));
    getDocs(q).then(snap => {
      if (cancelled) return;
      const docs = snap.docs.map(d => d.data() as ReportRollup).sort((a, b) => a.date.localeCompare(b.date));
      setRollups(docs);
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) { setRollups([]); setIsLoading(false); }
    });
    return () => { cancelled = true; };
  }, [tenantId, storeId, days]);

  return { rollups, isLoading };
}
