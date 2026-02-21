"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useStokYariMamulRealtime() {
  return useRealtimeSubscription({
    channelName: "stok-yari-mamul-realtime",
    subscriptions: [
      { event: "*", table: "yari_mamul_stok" },
    ],
    debounceMs: 3000, // 234K+ satır — yüksek debounce
  });
}
