"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useNotificationRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_reads" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);
}
