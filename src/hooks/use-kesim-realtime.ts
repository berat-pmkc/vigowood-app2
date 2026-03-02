"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useKesimRealtime() {
  return useRealtimeSubscription({
    channelName: "kesim-realtime",
    subscriptions: [
      { event: "*", table: "cut_batches" },
      { event: "*", table: "makine_durum_log" },
    ],
    debounceMs: 1000,
  });
}
