"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useUnreadCount(userId: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    // Kullanıcıya görünen tüm bildirimler
    const { data: notifications } = await supabase
      .from("notifications")
      .select("notif_id, target_user");

    if (!notifications) return;

    const visible = notifications.filter((n) => {
      if (!n.target_user) return true;
      return n.target_user.split(",").includes(userId);
    });

    // Okunanlar
    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notif_id")
      .eq("user_id", userId);

    const readSet = new Set((reads ?? []).map((r) => r.notif_id));
    const unread = visible.filter((n) => !readSet.has(n.notif_id));
    setCount(unread.length);
  }, [userId]);

  useEffect(() => {
    fetchCount();

    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel("unread-count-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchCount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_reads" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCount]);

  return count;
}
