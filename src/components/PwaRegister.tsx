'use client';

import { useEffect } from 'react';

/** Registers the service worker in production for installable/offline PWA support. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* SW registration is best-effort */ });
    }
  }, []);
  return null;
}
