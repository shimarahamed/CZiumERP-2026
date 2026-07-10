'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Returns true for a brief window after the pathname changes,
 * giving pages time to mount and begin their own skeleton rendering.
 */
export function useNavigationLoading(delayMs = 120) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const t = setTimeout(() => setIsNavigating(false), delayMs);
    return () => clearTimeout(t);
  }, [pathname, delayMs]);

  return isNavigating;
}
