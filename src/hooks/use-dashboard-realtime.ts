"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useDashboardRealtime() {
  return useRealtimeSubscription({
    channelName: "dashboard-realtime",
    subscriptions: [
      { event: "*", table: "cut_batches" },
      { event: "*", table: "stock_movements" },
      { event: "*", table: "pack_events" },
      { event: "UPDATE", table: "all_parts" },
    ],
    debounceMs: 2000,
  });
}
