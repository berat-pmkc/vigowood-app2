"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useKutuRealtime() {
  return useRealtimeSubscription({
    channelName: "kutu-realtime",
    subscriptions: [
      { event: "*", table: "kutu_uretim" },
    ],
    debounceMs: 1000,
  });
}
