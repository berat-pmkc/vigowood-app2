"use client";

import { useRealtimeSubscription } from "./use-realtime-subscription";

/**
 * Ops Center tasks tablosundaki değişiklikleri dinler.
 * AI agent veya başka bir kullanıcı task durumunu değiştirdiğinde
 * board otomatik güncellenir (router.refresh).
 */
export function useTasksRealtime(enabled = true) {
  return useRealtimeSubscription({
    channelName: "ops-tasks-realtime",
    subscriptions: [
      { event: "*", table: "tasks" },
      { event: "INSERT", table: "task_activity" },
    ],
    debounceMs: 800,
    enabled,
  });
}
