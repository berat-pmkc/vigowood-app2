"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useMontajRealtime() {
  return useRealtimeSubscription({
    channelName: "montaj-realtime",
    subscriptions: [
      { event: "*", table: "montaj_batches" },
    ],
    debounceMs: 1000,
  });
}
