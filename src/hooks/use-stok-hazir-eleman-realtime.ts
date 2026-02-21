"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useStokHazirElemanRealtime() {
  return useRealtimeSubscription({
    channelName: "stok-hazir-eleman-realtime",
    subscriptions: [
      { event: "*", table: "hazir_eleman_akis" },
    ],
    debounceMs: 1500,
  });
}
