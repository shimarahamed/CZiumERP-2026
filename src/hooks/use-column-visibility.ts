'use client';

import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

export type ColumnDef = {
  id: string;
  label: string;
  /** Columns that can't be hidden (e.g. the row's primary identifier or the actions menu). */
  locked?: boolean;
};

/**
 * Per-user, per-table column show/hide, persisted on User.columnPreferences[tableId]
 * (the list of hidden column ids) via the same setUsers()-writes-Firestore path that
 * dashboardSettings already uses — no separate persistence plumbing needed.
 */
export function useColumnVisibility(tableId: string, columns: ColumnDef[]) {
  const { user, setUsers } = useAppContext();

  const hiddenIds = useMemo(
    () => new Set(user?.columnPreferences?.[tableId] ?? []),
    [user, tableId]
  );

  const isVisible = useCallback((columnId: string) => !hiddenIds.has(columnId), [hiddenIds]);

  const toggleColumn = useCallback((columnId: string, visible: boolean) => {
    if (!user) return;
    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u;
      const current = new Set(u.columnPreferences?.[tableId] ?? []);
      if (visible) current.delete(columnId); else current.add(columnId);
      return {
        ...u,
        columnPreferences: { ...u.columnPreferences, [tableId]: Array.from(current) },
      };
    }));
  }, [user, setUsers, tableId]);

  const resetColumns = useCallback(() => {
    if (!user) return;
    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u;
      const { [tableId]: _removed, ...rest } = u.columnPreferences ?? {};
      return { ...u, columnPreferences: rest };
    }));
  }, [user, setUsers, tableId]);

  return { columns, isVisible, toggleColumn, resetColumns, hiddenCount: hiddenIds.size };
}
