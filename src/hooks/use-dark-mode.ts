'use client';

import { useEffect, useState } from 'react';

const DARK_MODE_KEY = 'czium-dark-mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Default to light on first visit (no stored preference yet) rather than
    // following the OS/browser's prefers-color-scheme.
    const stored = localStorage.getItem(DARK_MODE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  }, [isDark]);

  const toggle = () => setIsDark(d => !d);

  return { isDark, toggle };
}
