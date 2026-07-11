'use client';

import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5_000;
const CHECK_TIMEOUT_MS = 3_000;

/**
 * Reports whether the internet path used by Firebase is reachable.
 * navigator.onLine is only a quick signal; the health request catches cases
 * where Wi-Fi/Ethernet is connected but there is no working internet route.
 */
export function useOnlineStatus() {
  // `null` means the initial connectivity check is still running. Treating
  // that short state as offline caused the banner to flash on every launch.
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;

    const check = async () => {
      activeController?.abort();

      if (!navigator.onLine) {
        if (!disposed) setIsOnline(false);
        return;
      }

      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      try {
        await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
          cache: 'no-store',
          mode: 'no-cors',
          signal: controller.signal,
        });
        // A no-cors response is opaque, but a resolved request proves that
        // DNS and the external network route are working.
        if (!disposed && activeController === controller) setIsOnline(true);
      } catch {
        if (!disposed && activeController === controller) setIsOnline(false);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const markOffline = () => {
      activeController?.abort();
      if (!disposed) setIsOnline(false);
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener('online', check);
    window.addEventListener('offline', markOffline);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', checkWhenVisible);

    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, []);

  return isOnline;
}
