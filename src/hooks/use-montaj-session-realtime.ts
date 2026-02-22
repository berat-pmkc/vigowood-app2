"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

export function useMontajSessionRealtime() {
  return useRealtimeSubscription({
    channelName: "montaj-session-realtime",
    subscriptions: [
      { event: "*", table: "montaj_sessions" },
    ],
    debounceMs: 1000,
  });
}
