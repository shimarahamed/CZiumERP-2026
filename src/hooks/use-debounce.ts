'use client';

import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value (e.g. a search input) so filtering of large
 * lists runs only after the user pauses typing.
 *
 *   const debouncedSearch = useDebounce(searchTerm, 250);
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
