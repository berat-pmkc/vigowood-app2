"use client";

import useSWR from "swr";
import { useEffect } from "react";

/**
 * Syncs server component props into SWR's in-memory cache.
 * On re-mount (back navigation), returns the cached version instantly
 * while the server component re-fetches fresh data.
 *
 * @param key - Stable cache key (e.g. "kesim-active")
 * @param serverData - Props from server component
 */
export function useServerDataCache<T>(key: string, serverData: T): T {
  const { data, mutate } = useSWR<T>(key, null, {
    fallbackData: serverData,
  });

  // When server props change (router.refresh or re-navigation), sync to cache
  useEffect(() => {
    mutate(serverData, false);
  }, [serverData, mutate]);

  return data ?? serverData;
}
