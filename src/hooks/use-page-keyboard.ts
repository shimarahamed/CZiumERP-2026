'use client';

import { useEffect } from 'react';

type ShortcutConfig = {
  /** Triggered by pressing 'n' (not in an input) — opens the new-record form */
  onNew?: () => void;
  /** Triggered by pressing '/' (not in an input) — focuses the search input */
  onSearch?: () => void;
  /** Custom keys: { key: callback } */
  custom?: Record<string, () => void>;
};

export function usePageKeyboard({ onNew, onSearch, custom }: ShortcutConfig) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;
      if (isEditing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' && onNew) {
        e.preventDefault();
        onNew();
        return;
      }

      if (custom) {
        const cb = custom[e.key];
        if (cb) {
          e.preventDefault();
          cb();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNew, onSearch, custom]);
}
