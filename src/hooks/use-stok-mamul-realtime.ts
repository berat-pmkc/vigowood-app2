"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useStokMamulRealtime() {
  return useRealtimeSubscription({
    channelName: "stok-mamul-realtime",
    subscriptions: [
      { event: "*", table: "stock_movements" },
    ],
    debounceMs: 1500,
  });
}
