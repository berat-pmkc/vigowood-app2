"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { PERSONEL_ACCESS_ROLES } from "@/lib/constants";

async function requirePersonelAccess() {
  const user = await getCurrentUser();
  if (!user || !PERSONEL_ACCESS_ROLES.includes(user.role as (typeof PERSONEL_ACCESS_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

// Station → Department mapping
const STATION_TO_DEPT: Record<string, string> = {
  Kesim: "Kesim",
  Temizlik: "Temizlik",
  Montaj: "Montaj",
  Paketleme: "Paketleme",
  Kutu: "Paketleme Hatti",
  "Kesim Hattı": "Kesim",
  "Temilik Hattı": "Temizlik",
  "Montaj Hattı": "Montaj",
  "Paketleme Hattı": "Paketleme",
  "Kutu Hattı": "Paketleme Hatti",
};

/** Tek kişi için hızlı yoklama toggle (08:00-18:00) */
export async function quickToggleAttendance(
  employeeName: string,
  station: string | null,
  date: string
): Promise<{ success: true; action: "created" | "removed" } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();

    // Bugün bu kişinin kaydı var mı?
    const { data: existing } = await supabase
      .from("attendance")
      .select("att_id")
      .eq("employee", employeeName)
      .eq("tarih", date)
      .limit(1);

    if (existing && existing.length > 0) {
      // Kaydı sil (toggle off) — silinen satırı geri iste, RLS engellerse
      // hata dönmediği için başarı sanılmasın
      const { data: silinen, error } = await supabase
        .from("attendance")
        .delete()
        .eq("att_id", existing[0].att_id)
        .select("att_id");

      if (error) throw error;
      if (!silinen || silinen.length === 0) {
        return {
          success: false,
          error: "Yoklama kaldırılamadı — bu işlem için yetkiniz olmayabilir",
        };
      }

      revalidatePath("/personel/liste");
      revalidatePath("/personel");
      return { success: true, action: "removed" };
    }

    // Yeni kayıt oluştur
    const now = new Date();
    const att_id = `ATT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0").slice(0, 2)}`;

    const department = station ? (STATION_TO_DEPT[station] || "Kesim") : "Kesim";

    const { error } = await supabase.from("attendance").insert({
      att_id,
      employee: employeeName,
      tarih: date,
      department,
      start_time: "08:00",
      end_time: "18:00",
    });

    if (error) throw error;

    revalidatePath("/personel/liste");
    revalidatePath("/personel");
    return { success: true, action: "created" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Departman bazlı toplu yoklama (08:00-18:00) */
export async function bulkQuickAttendance(
  employees: { full_name: string; station: string | null }[],
  date: string
): Promise<{ success: true; created: number; skipped: number } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();

    // Bu tarihte mevcut kayıtları al
    const employeeNames = employees.map((e) => e.full_name);
    const { data: existing } = await supabase
      .from("attendance")
      .select("employee")
      .eq("tarih", date)
      .in("employee", employeeNames);

    const existingSet = new Set((existing ?? []).map((r) => r.employee));

    // Kayıt olmayanlara yeni kayıt oluştur
    const toInsert = employees
      .filter((e) => !existingSet.has(e.full_name))
      .map((e, idx) => {
        const now = new Date();
        const ms = String(now.getMilliseconds()).padStart(3, "0");
        const att_id = `ATT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${ms}${String(idx).padStart(2, "0")}`;
        const department = e.station ? (STATION_TO_DEPT[e.station] || "Kesim") : "Kesim";

        return {
          att_id,
          employee: e.full_name,
          tarih: date,
          department,
          start_time: "08:00",
          end_time: "18:00",
        };
      });

    if (toInsert.length === 0) {
      return { success: true, created: 0, skipped: employeeNames.length };
    }

    const { error } = await supabase.from("attendance").insert(toInsert);
    if (error) throw error;

    revalidatePath("/personel/liste");
    revalidatePath("/personel");
    return {
      success: true,
      created: toInsert.length,
      skipped: existingSet.size,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Yoklama saatini güncelle (inline edit) */
export async function updateAttendanceTime(
  attId: string,
  startTime: string,
  endTime: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("attendance")
      .update({ start_time: startTime, end_time: endTime })
      .eq("att_id", attId);

    if (error) throw error;

    revalidatePath("/personel/liste");
    revalidatePath("/personel");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Tüm departmanlar için toplu yoklama kaldır */
export async function bulkRemoveAttendance(
  employeeNames: string[],
  date: string
): Promise<{ success: true; removed: number } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("attendance")
      .select("att_id")
      .eq("tarih", date)
      .in("employee", employeeNames);

    if (!existing || existing.length === 0) {
      return { success: true, removed: 0 };
    }

    // Silinen satırları geri iste — RLS engellerse hata dönmez, sessizce
    // 0 satır silinir. Eskiden planlanan sayı döndürüldüğü için arayüz
    // "kaldırıldı" diyor ama kayıtlar yerinde kalıyordu.
    const { data: silinen, error } = await supabase
      .from("attendance")
      .delete()
      .in("att_id", existing.map((r) => r.att_id))
      .select("att_id");

    if (error) throw error;

    const removed = silinen?.length ?? 0;
    if (removed === 0) {
      return {
        success: false,
        error: "Kayıtlar silinemedi — bu işlem için yetkiniz olmayabilir",
      };
    }

    revalidatePath("/personel/liste");
    revalidatePath("/personel");
    return { success: true, removed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}
