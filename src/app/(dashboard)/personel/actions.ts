"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { attendanceCreateSchema, type AttendanceCreateData } from "@/lib/validations";
import { PERSONEL_ACCESS_ROLES } from "@/lib/constants";

async function requirePersonelAccess() {
  const user = await getCurrentUser();
  if (!user || !PERSONEL_ACCESS_ROLES.includes(user.role as (typeof PERSONEL_ACCESS_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "Yönetici") {
    throw new Error("Bu işlem sadece yöneticiler tarafından yapılabilir");
  }
  return user;
}

/** Aktif Üretim/Hat kullanıcılarını getir (combobox için) */
export async function getEmployeeList(): Promise<
  { user_id: string; full_name: string; station: string | null }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("user_id, full_name, station")
    .in("role", ["Üretim", "Hat"])
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as { user_id: string; full_name: string; station: string | null }[];
}

/** Yeni yoklama kaydı oluştur */
export async function createAttendance(
  formData: AttendanceCreateData
): Promise<{ success: true; att_id: string } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const parsed = attendanceCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();

    // Auto-ID: ATT-YYYYMMDD-HHMMSS
    const now = new Date();
    const att_id = `ATT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const { error } = await supabase.from("attendance").insert({
      att_id,
      employee: parsed.data.employee,
      tarih: parsed.data.tarih,
      department: parsed.data.department,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      not_text: parsed.data.not_text || null,
    });

    if (error) throw error;

    revalidatePath("/personel");
    return { success: true, att_id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Yoklama kaydını güncelle */
export async function updateAttendance(
  att_id: string,
  formData: AttendanceCreateData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const parsed = attendanceCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("attendance")
      .update({
        employee: parsed.data.employee,
        tarih: parsed.data.tarih,
        department: parsed.data.department,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        not_text: parsed.data.not_text || null,
      })
      .eq("att_id", att_id);

    if (error) throw error;

    revalidatePath("/personel");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Yoklama kaydını sil (sadece Yönetici) */
export async function deleteAttendance(
  att_id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("att_id", att_id);

    if (error) throw error;

    revalidatePath("/personel");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}
