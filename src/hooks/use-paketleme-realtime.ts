"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function usePaketlemeRealtime() {
  return useRealtimeSubscription({
    channelName: "paketleme-realtime",
    subscriptions: [
      { event: "*", table: "pack_events" },
    ],
    debounceMs: 1000,
  });
}
