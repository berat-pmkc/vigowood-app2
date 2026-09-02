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

/**
 * Yoklama kaydını siler.
 *
 * Eskiden yalnızca Yönetici silebiliyordu; yoklamayı girebilen rollerin
 * yanlış kaydı geri alabilmesi gerektiği için personel erişimine açıldı.
 *
 * Silinen satır sayısı doğrulanıyor: RLS engellediğinde PostgREST hata
 * döndürmüyor, sessizce 0 satır siliyor. Doğrulama olmadan uygulama
 * başarılı sanıp kullanıcıya yanlış bilgi veriyordu.
 */
export async function deleteAttendance(
  att_id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();

    const { data: silinen, error } = await supabase
      .from("attendance")
      .delete()
      .eq("att_id", att_id)
      .select("att_id");

    if (error) throw error;
    if (!silinen || silinen.length === 0) {
      return {
        success: false,
        error: "Kayıt silinemedi — yetkiniz olmayabilir veya kayıt zaten silinmiş",
      };
    }

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
  /** Ayın pazarlar ve resmî tatiller düşülmüş iş günü sayısı */
  hedef_gun: number;
  ay: string;
  /** O ay içindeki resmî tatiller — arayüzde gösterilir */
  tatiller: { tarih: string; ad: string }[];
}

/**
 * Verilen ayın iş günü sayısı: pazarlar ve resmî tatiller düşülür.
 *
 * Pazara denk gelen tatil zaten sayılmadığı için iki kez düşülmez.
 */
function isGunuSayisi(yil: number, ay: number, tatilTarihleri: Set<string>): number {
  const sonGun = new Date(yil, ay, 0).getDate();
  let sayi = 0;
  for (let g = 1; g <= sonGun; g++) {
    const tarih = new Date(yil, ay - 1, g);
    if (tarih.getDay() === 0) continue; // pazar
    const iso = `${yil}-${String(ay).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
    if (tatilTarihleri.has(iso)) continue; // resmî tatil
    sayi++;
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
  const { data: tatiller } = await supabase
    .from("resmi_tatiller")
    .select("tarih, ad")
    .gte("tarih", ilkGun)
    .lte("tarih", sonGun)
    .eq("aktif", true)
    .eq("hedeften_dus", true);

  const tatilListesi = (tatiller ?? []) as { tarih: string; ad: string }[];
  const tatilSet = new Set(tatilListesi.map((t) => t.tarih));
  const hedef_gun = isGunuSayisi(yil, ayNo, tatilSet);

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

  return { satirlar, hedef_gun, ay, tatiller: tatilListesi };
}


// ─── Puantaj (aylık çizelge: kişi × gün) ────────────────────

export type PuantajDurum = "geldi" | "izinli" | "raporlu" | "devamsiz";

export interface PuantajGun {
  tarih: string;
  gun: number;
  haftaGunu: string;
  cumartesi: boolean;
}

export interface PuantajSatir {
  user_id: string;
  full_name: string;
  station: string | null;
  department: string | null;
  /** tarih → durum (yalnızca kaydı olan günler; olmayan iş günü = devamsız) */
  hucreler: Record<string, PuantajDurum>;
  geldi: number;
  izinli: number;
  raporlu: number;
  devamsiz: number;
  toplamGun: number;
  toplamMesaiDk: number;
}

export interface PuantajSonuc {
  ay: string;
  gunler: PuantajGun[];
  satirlar: PuantajSatir[];
  tatiller: { tarih: string; ad: string }[];
}

/**
 * Aylık puantaj çizelgesi.
 *
 * İş günü tanımı: o ay içinde en az bir yoklama kaydı bulunan günler
 * (yani firmanın fiilen çalıştığı günler), pazarlar ve resmî tatiller hariç.
 * Kapsam: tüm aktif Üretim + Hat personeli — hiç gelmeyen de satır olarak görünür.
 * Eşleşme: attendance.employee, kullanıcının user_id'si VEYA full_name'i olabilir
 * (eski AppSheet verisi isim, uygulama içi kayıt user_id tutuyor).
 */
export async function getPuantaj(ay: string): Promise<PuantajSonuc> {
  await requirePersonelAccess();
  const supabase = await createClient();

  const [yilStr, ayStr] = ay.split("-");
  const yil = Number(yilStr);
  const ayNo = Number(ayStr);
  const ilkGun = `${ay}-01`;
  const sonGunSayisi = new Date(yil, ayNo, 0).getDate();
  const sonGun = `${ay}-${String(sonGunSayisi).padStart(2, "0")}`;

  const { data: tatiller } = await supabase
    .from("resmi_tatiller")
    .select("tarih, ad")
    .gte("tarih", ilkGun)
    .lte("tarih", sonGun)
    .eq("aktif", true)
    .eq("hedeften_dus", true);
  const tatilListesi = (tatiller ?? []) as { tarih: string; ad: string }[];
  const tatilSet = new Set(tatilListesi.map((t) => t.tarih));

  const { data: personel } = await supabase
    .from("users")
    .select("user_id, full_name, station")
    .in("role", ["Üretim", "Hat"])
    .eq("is_active", true)
    .order("full_name");

  const { data: kayitlar } = await supabase
    .from("attendance")
    .select("employee, tarih, department, durum, start_time, end_time")
    .gte("tarih", ilkGun)
    .lte("tarih", sonGun);

  type K = {
    employee: string;
    tarih: string;
    department: string | null;
    durum: string;
    start_time: string | null;
    end_time: string | null;
  };
  const kayitListe = (kayitlar ?? []) as K[];

  // Çalışılan günler: en az bir kayıt olan, pazar ve resmî tatil olmayan günler
  const gunSet = new Set<string>();
  for (const k of kayitListe) {
    const d = new Date(k.tarih + "T00:00:00");
    if (d.getDay() === 0) continue; // pazar
    if (tatilSet.has(k.tarih)) continue; // resmî tatil
    gunSet.add(k.tarih);
  }
  const HG = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const gunler: PuantajGun[] = [...gunSet].sort().map((t) => {
    const d = new Date(t + "T00:00:00");
    return { tarih: t, gun: d.getDate(), haftaGunu: HG[d.getDay()], cumartesi: d.getDay() === 6 };
  });

  const dakika = (bas: string | null, bit: string | null) => {
    if (!bas || !bit) return 0;
    const [bs, bd] = bas.split(":").map(Number);
    const [ts, td] = bit.split(":").map(Number);
    const fark = ts * 60 + td - (bs * 60 + bd);
    return fark > 0 ? fark : 0;
  };

  // Aynı gün birden çok kayıt olursa: geldi > izin/rapor > devamsız
  const oncelik: Record<string, number> = { geldi: 3, izinli: 2, raporlu: 2, devamsiz: 1 };

  const satirlar: PuantajSatir[] = (
    (personel ?? []) as { user_id: string; full_name: string; station: string | null }[]
  ).map((p) => {
    const kendi = kayitListe.filter(
      (k) => k.employee === p.user_id || k.employee === p.full_name
    );
    const hucreler: Record<string, PuantajDurum> = {};
    let toplamMesaiDk = 0;
    for (const k of kendi) {
      if (!gunSet.has(k.tarih)) continue;
      const dv = (["geldi", "izinli", "raporlu", "devamsiz"].includes(k.durum)
        ? k.durum
        : "geldi") as PuantajDurum;
      const cur = hucreler[k.tarih];
      if (!cur || (oncelik[dv] ?? 0) > (oncelik[cur] ?? 0)) hucreler[k.tarih] = dv;
      if (dv === "geldi") toplamMesaiDk += dakika(k.start_time, k.end_time);
    }
    let geldi = 0,
      izinli = 0,
      raporlu = 0;
    for (const t of gunSet) {
      const v = hucreler[t];
      if (v === "geldi") geldi++;
      else if (v === "izinli") izinli++;
      else if (v === "raporlu") raporlu++;
    }
    const toplamGun = gunSet.size;
    const devamsiz = Math.max(0, toplamGun - geldi - izinli - raporlu);
    const department = kendi.find((k) => k.department)?.department ?? null;
    return {
      user_id: p.user_id,
      full_name: p.full_name,
      station: p.station,
      department,
      hucreler,
      geldi,
      izinli,
      raporlu,
      devamsiz,
      toplamGun,
      toplamMesaiDk,
    };
  });

  return { ay, gunler, satirlar, tatiller: tatilListesi };
}


// ─── Resmî Tatil Takvimi ────────────────────────────────────

export interface ResmiTatil {
  tarih: string;
  ad: string;
  hedeften_dus: boolean;
  aktif: boolean;
}

export async function getResmiTatiller(yil: number): Promise<ResmiTatil[]> {
  await requirePersonelAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("resmi_tatiller")
    .select("tarih, ad, hedeften_dus, aktif")
    .gte("tarih", `${yil}-01-01`)
    .lte("tarih", `${yil}-12-31`)
    .order("tarih");
  return (data ?? []) as ResmiTatil[];
}

export async function upsertResmiTatil(
  t: ResmiTatil
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    if (!t.tarih || !t.ad.trim()) {
      return { success: false, error: "Tarih ve tatil adı gereklidir" };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("resmi_tatiller").upsert(
      {
        tarih: t.tarih,
        ad: t.ad.trim(),
        hedeften_dus: t.hedeften_dus,
        aktif: t.aktif,
      },
      { onConflict: "tarih" }
    );
    if (error) return { success: false, error: error.message };
    revalidatePath("/personel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteResmiTatil(
  tarih: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePersonelAccess();
    const supabase = await createClient();
    const { error } = await supabase.from("resmi_tatiller").delete().eq("tarih", tarih);
    if (error) return { success: false, error: error.message };
    revalidatePath("/personel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
