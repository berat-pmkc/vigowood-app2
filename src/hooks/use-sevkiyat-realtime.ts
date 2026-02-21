"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useSevkiyatRealtime() {
  return useRealtimeSubscription({
    channelName: "sevkiyat-realtime",
    subscriptions: [
      { event: "*", table: "sevkiyat" },
      { event: "*", table: "sevkiyat_items" },
    ],
    debounceMs: 1000,
  });
}
