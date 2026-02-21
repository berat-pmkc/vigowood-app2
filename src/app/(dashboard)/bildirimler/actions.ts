"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notificationCreateSchema, type NotificationCreateData } from "@/lib/validations";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "Yönetici") {
    throw new Error("Bu işlem sadece yöneticiler tarafından yapılabilir");
  }
  return user;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Giriş yapmanız gerekiyor");

  // Station hesap desteği: operatörün user_id'si
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const operatorId = authUser?.user_metadata?.selected_operator_id as string | undefined;
  const effectiveUserId = operatorId || user.user_id;

  return { user, effectiveUserId, supabase };
}

/** Yeni bildirim oluştur (Admin only) */
export async function createNotification(
  formData: NotificationCreateData
): Promise<{ success: true; notif_id: string } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = notificationCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Auto-ID: NOT-YYYYMMDD-HHMMSS
    const now = new Date();
    const notif_id = `NOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    // target_user: boş array = herkese, dolu = comma-separated
    const targetUser = parsed.data.target_users.length > 0
      ? parsed.data.target_users.join(",")
      : null;

    const { error } = await supabase.from("notifications").insert({
      notif_id,
      title: parsed.data.title,
      message: parsed.data.message || null,
      target_user: targetUser,
      created_by: authUser?.email || null,
      status: "Yeni",
    });

    if (error) throw error;

    revalidatePath("/bildirimler");
    return { success: true, notif_id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Bildirim oluşturulamadı" };
  }
}

/** Bildirim sil (Admin only, CASCADE ile reads de silinir) */
export async function deleteNotification(
  notifId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("notif_id", notifId);

    if (error) throw error;

    revalidatePath("/bildirimler");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Bildirim silinemedi" };
  }
}

/** Tek bildirimi okundu yap */
export async function markAsRead(
  notifId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { effectiveUserId, supabase } = await requireAuth();

    // UPSERT — zaten okunmuşsa tekrar ekleme
    const { error } = await supabase
      .from("notification_reads")
      .upsert(
        { notif_id: notifId, user_id: effectiveUserId },
        { onConflict: "notif_id,user_id" }
      );

    if (error) throw error;

    revalidatePath("/bildirimler");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Okundu yapılamadı" };
  }
}

/** Tüm bildirimleri okundu yap */
export async function markAllAsRead(): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { effectiveUserId, supabase } = await requireAuth();

    // Kullanıcıya görünen tüm bildirimleri al
    const { data: notifications } = await supabase
      .from("notifications")
      .select("notif_id, target_user");

    if (!notifications || notifications.length === 0) {
      return { success: true };
    }

    // Kullanıcıya görünen bildirimleri filtrele
    const visibleNotifs = notifications.filter((n) => {
      if (!n.target_user) return true; // herkese
      return n.target_user.split(",").includes(effectiveUserId);
    });

    if (visibleNotifs.length === 0) return { success: true };

    // Zaten okunanları çıkar
    const { data: existingReads } = await supabase
      .from("notification_reads")
      .select("notif_id")
      .eq("user_id", effectiveUserId);

    const readSet = new Set((existingReads ?? []).map((r) => r.notif_id));
    const unreadNotifs = visibleNotifs.filter((n) => !readSet.has(n.notif_id));

    if (unreadNotifs.length === 0) return { success: true };

    // Batch insert
    const inserts = unreadNotifs.map((n) => ({
      notif_id: n.notif_id,
      user_id: effectiveUserId,
    }));

    const { error } = await supabase.from("notification_reads").insert(inserts);
    if (error) throw error;

    revalidatePath("/bildirimler");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "İşlem başarısız" };
  }
}

/** Aktif kullanıcı listesi (admin — bildirim hedef seçimi için) */
export async function getActiveUsers(): Promise<
  { user_id: string; full_name: string; role: string }[]
> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("user_id, full_name, role")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as { user_id: string; full_name: string; role: string }[];
}
