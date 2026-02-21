"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useTemizlikRealtime() {
  return useRealtimeSubscription({
    channelName: "temizlik-realtime",
    subscriptions: [
      { event: "*", table: "clean" },
      { event: "UPDATE", table: "cut_batches" },
    ],
    debounceMs: 1000,
  });
}
