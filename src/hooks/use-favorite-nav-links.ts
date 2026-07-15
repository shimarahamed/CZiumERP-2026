'use client';

import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

/**
 * Per-user favourite sidebar links, persisted on User.favoriteNavLinks via the
 * same setUsers()-writes-Firestore path that columnPreferences already uses.
 */
export function useFavoriteNavLinks() {
  const { user, setUsers } = useAppContext();

  const favoriteHrefs = useMemo(
    () => new Set(user?.favoriteNavLinks ?? []),
    [user]
  );

  const isFavorite = useCallback((href: string) => favoriteHrefs.has(href), [favoriteHrefs]);

  const toggleFavorite = useCallback((href: string) => {
    if (!user) return;
    setUsers(prev => prev.map(u => {
      const isSelf = u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase();
      if (!isSelf) return u;
      const current = new Set(u.favoriteNavLinks ?? []);
      if (current.has(href)) current.delete(href); else current.add(href);
      return { ...u, favoriteNavLinks: Array.from(current) };
    }));
  }, [user, setUsers]);

  return { favoriteHrefs, isFavorite, toggleFavorite };
}
