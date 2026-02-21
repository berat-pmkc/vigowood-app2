import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BildirimlerClient } from "./components/bildirimler-client";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function BildirimlerPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // Station hesap desteği
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const operatorId = authUser?.user_metadata?.selected_operator_id as string | undefined;
  const effectiveUserId = operatorId || profile.user_id;
  const isAdmin = profile.role === "Yönetici";

  // Tüm bildirimler (en yeni önce)
  const { data: notifications } = await supabase
    .from("notifications")
    .select("notif_id, title, message, target_user, created_by, created_at")
    .order("created_at", { ascending: false });

  // Kullanıcının okuduğu bildirimler
  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notif_id")
    .eq("user_id", effectiveUserId);

  return (
    <BildirimlerClient
      notifications={(notifications ?? []) as {
        notif_id: string;
        title: string;
        message: string | null;
        target_user: string | null;
        created_by: string | null;
        created_at: string;
      }[]}
      readNotifIds={(reads ?? []).map((r) => r.notif_id)}
      isAdmin={isAdmin}
      userId={effectiveUserId}
    />
  );
}
