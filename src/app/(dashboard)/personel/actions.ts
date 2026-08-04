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
      durum: parsed.data.durum,
      // Gelinmeyen günlerde saat tutulmaz
      start_time: parsed.data.durum === "geldi" ? parsed.data.start_time : null,
      end_time: parsed.data.durum === "geldi" ? parsed.data.end_time : null,
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
        durum: parsed.data.durum,
        start_time: parsed.data.durum === "geldi" ? parsed.data.start_time : null,
        end_time: parsed.data.durum === "geldi" ? parsed.data.end_time : null,
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

// ─── Devamsızlık Takibi ─────────────────────────────────────

export interface DevamsizlikSatir {
  employee: string;
  full_name: string;
  department: string | null;
  station: string | null;
  geldi: number;
  izinli: number;
  raporlu: number;
  devamsiz: number;
  /** Kayıt bulunmayan iş günleri — ne gelmiş ne de mazereti girilmiş */
  kayitsiz: number;
  toplam_mesai_dk: number;
}

export interface DevamsizlikOzet {
  satirlar: DevamsizlikSatir[];
  /** Ayın pazar dışındaki gün sayısı */
  hedef_gun: number;
  ay: string;
}

/** Verilen ayın pazar günleri hariç gün sayısı */
function isGunuSayisi(yil: number, ay: number): number {
  const sonGun = new Date(yil, ay, 0).getDate();
  let sayi = 0;
  for (let g = 1; g <= sonGun; g++) {
    // getDay(): 0 = Pazar
    if (new Date(yil, ay - 1, g).getDay() !== 0) sayi++;
  }
  return sayi;
}

/**
 * Personel bazlı aylık devamsızlık özeti.
 *
 * Hedef gün sayısı ayın pazarları düşülerek hesaplanır (Şubat 24, Mart 26 gibi).
 * Resmi tatiller düşülmez — gerekirse ilerde ayarlardan tanımlanabilir.
 *
 * "Kayıtsız" sütunu önemli: ne geldi ne de mazeret kaydı olan iş günleri.
 * Yoklaması hiç girilmemiş günleri yakalamak için.
 */
export async function getDevamsizlikOzeti(ay: string): Promise<DevamsizlikOzet> {
  await requirePersonelAccess();
  const supabase = await createClient();

  const [yilStr, ayStr] = ay.split("-");
  const yil = Number(yilStr);
  const ayNo = Number(ayStr);
  const ilkGun = `${ay}-01`;
  const sonGunSayisi = new Date(yil, ayNo, 0).getDate();
  const sonGun = `${ay}-${String(sonGunSayisi).padStart(2, "0")}`;
  const hedef_gun = isGunuSayisi(yil, ayNo);

  const { data: personel } = await supabase
    .from("users")
    .select("user_id, full_name, station")
    .eq("is_active", true)
    .order("full_name");

  const { data: kayitlar } = await supabase
    .from("attendance")
    .select("employee, department, durum, start_time, end_time")
    .gte("tarih", ilkGun)
    .lte("tarih", sonGun);

  type K = {
    employee: string;
    department: string | null;
    durum: string;
    start_time: string | null;
    end_time: string | null;
  };
  const kayitListe = (kayitlar ?? []) as K[];

  const dakika = (bas: string | null, bit: string | null) => {
    if (!bas || !bit) return 0;
    const [bs, bd] = bas.split(":").map(Number);
    const [ts, td] = bit.split(":").map(Number);
    const fark = ts * 60 + td - (bs * 60 + bd);
    return fark > 0 ? fark : 0;
  };

  const satirlar: DevamsizlikSatir[] = (
    (personel ?? []) as { user_id: string; full_name: string; station: string | null }[]
  ).map((p) => {
    const kendi = kayitListe.filter((k) => k.employee === p.user_id);
    const say = (d: string) => kendi.filter((k) => k.durum === d).length;
    const geldi = say("geldi");
    const izinli = say("izinli");
    const raporlu = say("raporlu");
    const devamsiz = say("devamsiz");

    return {
      employee: p.user_id,
      full_name: p.full_name,
      department: kendi.find((k) => k.department)?.department ?? null,
      station: p.station,
      geldi,
      izinli,
      raporlu,
      devamsiz,
      kayitsiz: Math.max(0, hedef_gun - (geldi + izinli + raporlu + devamsiz)),
      toplam_mesai_dk: kendi.reduce((t, k) => t + dakika(k.start_time, k.end_time), 0),
    };
  });

  return { satirlar, hedef_gun, ay };
}
