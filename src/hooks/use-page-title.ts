'use client';

import { useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export function usePageTitle(pageTitle: string) {
  const { themeSettings } = useAppContext();
  useEffect(() => {
    document.title = `${pageTitle} — ${themeSettings.appName}`;
    return () => {
      document.title = themeSettings.appName;
    };
  }, [pageTitle, themeSettings.appName]);
}
