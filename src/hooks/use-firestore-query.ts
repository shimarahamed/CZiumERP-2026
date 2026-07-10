'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, type Query } from 'firebase/firestore';

export function useFirestoreQuery<T>(query: Query | null) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      return;
    }
    
    // It's assumed the query object passed in is stable (e.g., from useMemo)
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (T & { id: string })[];
        setData(newData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching Firestore query:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { data, isLoading };
}
