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

  const orderedColumns = useMemo(() => {
    const saved = user?.columnOrderPreferences?.[tableId] ?? [];
    const byId = new Map(columns.map(column => [column.id, column]));
    return [
      ...saved.map(id => byId.get(id)).filter((column): column is ColumnDef => Boolean(column)),
      ...columns.filter(column => !saved.includes(column.id)),
    ];
  }, [columns, tableId, user]);

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
      const { [tableId]: _removedOrder, ...orderRest } = u.columnOrderPreferences ?? {};
      return { ...u, columnPreferences: rest, columnOrderPreferences: orderRest };
    }));
  }, [user, setUsers, tableId]);

  const moveColumn = useCallback((columnId: string, direction: -1 | 1) => {
    if (!user) return;
    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u;
      const saved = u.columnOrderPreferences?.[tableId] ?? [];
      const knownIds = columns.map(column => column.id);
      const order = [...saved.filter(id => knownIds.includes(id)), ...knownIds.filter(id => !saved.includes(id))];
      const index = order.indexOf(columnId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return u;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...u, columnOrderPreferences: { ...u.columnOrderPreferences, [tableId]: order } };
    }));
  }, [columns, setUsers, tableId, user]);

  return { columns: orderedColumns, isVisible, toggleColumn, moveColumn, resetColumns, hiddenCount: hiddenIds.size };
}
