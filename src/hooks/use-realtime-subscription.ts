"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { debounce } from "@/lib/debounce";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface SubscriptionConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
}

interface UseRealtimeSubscriptionOptions {
  channelName: string;
  subscriptions: SubscriptionConfig[];
  debounceMs?: number;
  enabled?: boolean;
}

interface UseRealtimeSubscriptionReturn {
  status: RealtimeStatus;
  lastUpdated: Date | null;
}

const MAX_BACKOFF_MS = 30_000;

export function useRealtimeSubscription({
  channelName,
  subscriptions,
  debounceMs = 1000,
  enabled = true,
}: UseRealtimeSubscriptionOptions): UseRealtimeSubscriptionReturn {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(() => {
    setLastUpdated(new Date());
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    const supabase = createClient();
    const debouncedRefresh = debounce(handleChange, debounceMs);

    const subscribe = () => {
      let channel = supabase.channel(channelName);

      for (const sub of subscriptions) {
        channel = channel.on(
          "postgres_changes" as never,
          {
            event: sub.event,
            schema: sub.schema ?? "public",
            table: sub.table,
            ...(sub.filter ? { filter: sub.filter } : {}),
          } as never,
          (() => {
            debouncedRefresh();
          }) as never
        );
      }

      channel.subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("connected");
          retryCountRef.current = 0;
        } else if (subscribeStatus === "CHANNEL_ERROR") {
          setStatus("error");
          // Exponential backoff reconnect
          const delay = Math.min(
            1000 * Math.pow(2, retryCountRef.current),
            MAX_BACKOFF_MS
          );
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            supabase.removeChannel(channel);
            channelRef.current = subscribe();
          }, delay);
        } else if (subscribeStatus === "CLOSED") {
          setStatus("disconnected");
        }
      });

      return channel;
    };

    setStatus("connecting");
    channelRef.current = subscribe();

    return () => {
      debouncedRefresh.cancel();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled]);

  return { status, lastUpdated };
}
