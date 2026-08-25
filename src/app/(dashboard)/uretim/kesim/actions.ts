"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cutBatchCreateSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES, KESIM_MAKINE_IDS, URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { donemAraligi } from "@/lib/donem";
import type { MachineStatusEntry, MdfStokItem } from "./types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** Aktif ürünleri getir (SKU selector için) */
export async function getActiveProducts() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("gunluk_satis", { ascending: false });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** SKU'ya göre plaka listesi (plakalar makineye bağlı değil, sadece SKU'ya bağlı) */
export async function getPlakalarForKesim(sku: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("plakalar")
      .select("plakalar_id, plaka_id, plaka_adi, sku, tipi, renk, kesim_sureleri")
      .contains("sku", [sku])
      .order("plaka_adi");

    if (error) return { success: false as const, error: error.message };

    const result = (data ?? []).map((p) => ({
      plakalar_id: p.plakalar_id,
      plaka_id: p.plaka_id,
      plaka_adi: p.plaka_adi,
      sku: p.sku,
      tipi: p.tipi,
      renk: p.renk,
      kesim_sureleri: (p.kesim_sureleri ?? {}) as Record<string, number | null>,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Seçilen plakanın parçalarını getir (preview) */
export async function getPlakaParts(plakaId: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: parts, error } = await supabase
      .from("plaka_parts")
      .select("ppart_id, plaka_id, part_id, default_qty")
      .eq("plaka_id", plakaId)
      .order("part_id");

    if (error) return { success: false as const, error: error.message };
    if (!parts || parts.length === 0) return { success: true as const, data: [] };

    // Fetch part names
    const partIds = parts.map((p) => p.part_id);
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", partIds);

    const partNameMap = new Map(
      (allParts ?? []).map((p) => [p.part_id, p.part_adi])
    );

    const result = parts.map((p) => ({
      ppart_id: p.ppart_id,
      part_id: p.part_id,
      part_adi: partNameMap.get(p.part_id) || "—",
      default_qty: p.default_qty ?? 0,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Yeni kesim batch + cut_lines oluştur */
export async function createCutBatch(formData: {
  makine_id: string;
  sku: string;
  plaka_id: string;
  adet: number;
  operator_id: string;
  plk_notu: string | null;
  /** Bu kesim bir talebi karşılıyorsa talep numarası — trigger kalan adedi düşer */
  talep_id?: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = cutBatchCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Get operator info — use form-provided operator_id
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = parsed.data.operator_id;
    const email = authUser?.email ?? user.email;

    // Generate next KES-XXXX ID
    const { data: lastBatch } = await supabase
      .from("cut_batches")
      .select("cut_id")
      .order("cut_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastBatch && lastBatch.length > 0) {
      const match = lastBatch[0].cut_id.match(/KES-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const cutId = `KES-${String(nextNum).padStart(4, "0")}`;

    // Get plaka_parts for this plaka_id
    const { data: plakaParts, error: ppError } = await supabase
      .from("plaka_parts")
      .select("part_id, default_qty")
      .eq("plaka_id", parsed.data.plaka_id);

    if (ppError) return { success: false, error: ppError.message };

    const now = new Date().toISOString();

    // Insert cut_batch — doğrudan tamamlandı olarak kaydet
    const { error: batchError } = await supabase.from("cut_batches").insert({
      cut_id: cutId,
      tarih: now,
      sku: parsed.data.sku,
      plaka_id: parsed.data.plaka_id,
      makine_id: parsed.data.makine_id,
      adet: parsed.data.adet,
      operator_id: operatorId,
      plk_notu: parsed.data.plk_notu,
      email: email,
      durum: "tamamlandi",
      baslama_zamani: now,
      bitis_zamani: now,
      talep_id: formData.talep_id ?? null,
    });

    if (batchError) return { success: false, error: batchError.message };

    // Generate cut_lines from plaka_parts
    if (plakaParts && plakaParts.length > 0) {
      // Get last K-XXXX ID
      const { data: lastLine } = await supabase
        .from("cut_lines")
        .select("cut_line_id")
        .order("cut_line_id", { ascending: false })
        .limit(1);

      let lineNum = 1;
      if (lastLine && lastLine.length > 0) {
        const match = lastLine[0].cut_line_id.match(/K-(\d+)/);
        if (match) lineNum = parseInt(match[1], 10) + 1;
      }

      const cutLines = plakaParts.map((pp) => {
        const lineId = `K-${String(lineNum).padStart(4, "0")}`;
        lineNum++;
        return {
          cut_line_id: lineId,
          cut_id: cutId,
          tarih: now,
          part_id: pp.part_id,
          adet: (pp.default_qty ?? 0) * parsed.data.adet,
          email: email,
        };
      });

      const { error: linesError } = await supabase.from("cut_lines").insert(cutLines);
      if (linesError) return { success: false, error: linesError.message };
    }

    // MDF stok düşümü: plaka tipi+renk ile eşleşen MDF hazır elemanın stoğunu düş
    if (parsed.data.plaka_id) {
      const { data: plakaData } = await supabase
        .from("plakalar")
        .select("tipi, renk")
        .eq("plaka_id", parsed.data.plaka_id)
        .limit(1)
        .single();

      if (plakaData?.tipi && plakaData?.renk) {
        const { data: mdfPart } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, hazir_eleman_aktif_stok")
          .eq("mdf_tipi", plakaData.tipi)
          .eq("mdf_renk", plakaData.renk)
          .limit(1)
          .single();

        if (mdfPart) {
          const newStok = mdfPart.hazir_eleman_aktif_stok - parsed.data.adet;
          await supabase
            .from("all_parts")
            .update({ hazir_eleman_aktif_stok: newStok })
            .eq("part_id", mdfPart.part_id);

          // Hareket kaydı (hazir_eleman_akis)
          const hakisNow = new Date();
          const hakisId = `HA-${hakisNow.getFullYear()}${String(hakisNow.getMonth() + 1).padStart(2, "0")}${String(hakisNow.getDate()).padStart(2, "0")}-${String(hakisNow.getHours()).padStart(2, "0")}${String(hakisNow.getMinutes()).padStart(2, "0")}${String(hakisNow.getSeconds()).padStart(2, "0")}`;

          const { data: hakisExisting } = await supabase
            .from("hazir_eleman_akis")
            .select("hakis_id")
            .eq("hakis_id", hakisId)
            .limit(1);

          const finalHakisId = hakisExisting && hakisExisting.length > 0
            ? `${hakisId}-${cutId}`
            : hakisId;

          await supabase.from("hazir_eleman_akis").insert({
            hakis_id: finalHakisId,
            tarih: now,
            part_id: mdfPart.part_id,
            qty: -parsed.data.adet,
            operator: operatorId,
            not_text: `Kesim MDF Düşüm (Oluşturma) — ${cutId}`,
          });
        }
      }
    }

    // YarıMamulStok'a otomatik IN kayıtları (kesim tamamlandığında)
    if (plakaParts && plakaParts.length > 0) {
      // Part adlarını çek
      const ymsPartIds = plakaParts.filter(l => l.part_id).map(l => l.part_id);
      const { data: ymsAllParts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi")
        .in("part_id", ymsPartIds.length > 0 ? ymsPartIds : ["__none__"]);

      const ymsPartNameMap = new Map(
        (ymsAllParts ?? []).map(p => [p.part_id, p.part_adi])
      );

      // Generate next YMS ID
      const { data: lastYms } = await supabase
        .from("yari_mamul_stok")
        .select("yms_id")
        .like("yms_id", "YMS-%")
        .order("yms_id", { ascending: false })
        .limit(1);

      let ymsNum = 1;
      if (lastYms && lastYms.length > 0) {
        const match = lastYms[0].yms_id.match(/YMS-(\d+)/);
        if (match) ymsNum = parseInt(match[1], 10) + 1;
      }

      const ymsInserts = plakaParts
        .filter(l => l.part_id)
        .map(l => {
          const ymsId = `YMS-${String(ymsNum).padStart(6, "0")}`;
          ymsNum++;
          return {
            yms_id: ymsId,
            tarih: now,
            part_id: l.part_id,
            part_adi: ymsPartNameMap.get(l.part_id) ?? null,
            sku: parsed.data.sku,
            qty: (l.default_qty ?? 0) * parsed.data.adet,
            direction: "IN",
            source: "Kesim",
            source_id: cutId,
            operator: operatorId,
          };
        });

      if (ymsInserts.length > 0) {
        const { error: ymsError } = await supabase.from("yari_mamul_stok").insert(ymsInserts);
        if (ymsError) return { success: false, error: ymsError.message };
      }
    }

    revalidatePath("/uretim/kesim");
    revalidatePath("/stok/hazir-eleman");
    revalidatePath("/stok/yari-mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Batch'in cut_lines + part_adi bilgisi */
export async function getCutLines(cutId: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: lines, error } = await supabase
      .from("cut_lines")
      .select("cut_line_id, cut_id, part_id, adet, renk, not_text")
      .eq("cut_id", cutId)
      .order("cut_line_id");

    if (error) return { success: false as const, error: error.message };
    if (!lines || lines.length === 0) return { success: true as const, data: [] };

    // Part adlarını çek
    const partIds = lines.filter(l => l.part_id).map(l => l.part_id!);
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", partIds.length > 0 ? partIds : ["__none__"]);

    const partNameMap = new Map(
      (allParts ?? []).map(p => [p.part_id, p.part_adi])
    );

    const result = lines.map(l => ({
      ...l,
      part_adi: l.part_id ? (partNameMap.get(l.part_id) ?? "—") : "—",
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Günlük satış hızına göre en çok satan ürünler (hızlı seçim için) */
export async function getTopCutSkus(limit: number = 10) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, gunluk_satis")
      .eq("aktif_mi", true)
      .gt("gunluk_satis", 0)
      .order("gunluk_satis", { ascending: false })
      .limit(limit);

    if (error) return { success: false as const, error: error.message };

    const result = (data ?? []).map((p) => ({
      sku: p.sku,
      urun_adi: p.urun_adi ?? p.sku,
      count: Number(p.gunluk_satis) || 0,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kesim operatörlerini getir (station='Kesim') */
export async function getKesimOperators() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, station")
      .eq("station", "Kesim")
      .order("full_name");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Makine durumunu toggle et (aktif ↔ bakim) + log kaydı */
export async function toggleMachineStatus(
  makineId: string,
  newDurum: "aktif" | "bakim",
  neden?: string
): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();
    const supabase = await createClient();

    const { error } = await supabase.from("makine_durum_log").insert({
      makine_id: makineId,
      durum: newDurum,
      neden: neden || null,
      degistiren: user.user_id,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kesim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Her makine için son durum kaydını getir */
export async function getMachineStatuses(): Promise<{
  success: boolean;
  data?: MachineStatusEntry[];
  error?: string;
}> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const results: MachineStatusEntry[] = [];

    for (const makineId of KESIM_MAKINE_IDS) {
      const { data } = await supabase
        .from("makine_durum_log")
        .select("makine_id, durum, neden, created_at")
        .eq("makine_id", makineId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        results.push(data[0] as MachineStatusEntry);
      } else {
        results.push({
          makine_id: makineId,
          durum: "aktif",
          neden: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** MDF stok seviyelerini getir (mdf_tipi not null olan parçalar) */
export async function getMdfStokLevels(): Promise<{
  success: boolean;
  data?: MdfStokItem[];
  error?: string;
}> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("all_parts")
      .select("part_id, part_adi, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .not("mdf_tipi", "is", null)
      .order("part_adi");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as MdfStokItem[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Kesim Talepleri ────────────────────────────────────────

export interface KesimTalebi {
  talep_id: string;
  sku: string;
  urun_adi: string | null;
  plaka_id: string;
  plaka_adi: string | null;
  plaka_tipi: string | null;
  plaka_renk: string | null;
  talep_adet: number;
  kesilen_adet: number;
  kalan_adet: number;
  durum: string;
  oncelik: string;
  talep_eden: string;
  talep_eden_adi: string | null;
  talep_notu: string | null;
  created_at: string;
}

/**
 * Açık kesim taleplerini getirir — acil olanlar üstte, sonra geliş sırası.
 * Kesimhane ekranı ve talep listesi bu fonksiyonu kullanır.
 */
export async function getKesimTalepleri(
  sadeceAcik: boolean = true
): Promise<KesimTalebi[]> {
  await requireProductionAccess();
  const supabase = await createClient();

  let query = supabase
    .from("kesim_talepleri")
    .select(
      "talep_id, sku, plaka_id, talep_adet, kesilen_adet, durum, oncelik, talep_eden, talep_notu, created_at"
    )
    .order("oncelik", { ascending: false })
    .order("created_at", { ascending: true });

  if (sadeceAcik) query = query.in("durum", ["bekliyor", "kesimde"]);
  else query = query.limit(200);

  const { data } = await query;
  const talepler = (data ?? []) as {
    talep_id: string;
    sku: string;
    plaka_id: string;
    talep_adet: number;
    kesilen_adet: number;
    durum: string;
    oncelik: string;
    talep_eden: string;
    talep_notu: string | null;
    created_at: string;
  }[];

  if (talepler.length === 0) return [];

  // Ürün, plaka ve kullanıcı adlarını tek seferde çek — satır başına
  // sorgu atmak yerine toplu eşleştirme
  const [urunler, plakalar, kisiler] = await Promise.all([
    supabase.from("products").select("sku, urun_adi").in("sku", [...new Set(talepler.map((t) => t.sku))]),
    supabase.from("plakalar").select("plaka_id, plaka_adi, tipi, renk").in("plaka_id", [...new Set(talepler.map((t) => t.plaka_id))]),
    supabase.from("users").select("user_id, full_name").in("user_id", [...new Set(talepler.map((t) => t.talep_eden))]),
  ]);

  const urunMap = new Map((urunler.data ?? []).map((u) => [u.sku, u.urun_adi]));
  const plakaMap = new Map(
    (plakalar.data ?? []).map((p) => [p.plaka_id, p])
  );
  const kisiMap = new Map((kisiler.data ?? []).map((k) => [k.user_id, k.full_name]));

  return talepler.map((t) => {
    const p = plakaMap.get(t.plaka_id);
    return {
      ...t,
      urun_adi: urunMap.get(t.sku) ?? null,
      plaka_adi: p?.plaka_adi ?? null,
      plaka_tipi: p?.tipi ?? null,
      plaka_renk: p?.renk ?? null,
      kalan_adet: Math.max(0, t.talep_adet - t.kesilen_adet),
      talep_eden_adi: kisiMap.get(t.talep_eden) ?? null,
    };
  });
}

/** Aynı plaka için açık talep var mı — mükerrer uyarısı için */
export async function getAcikTalepOzeti(
  plakaId: string
): Promise<{ adet: number; toplam: number }> {
  await requireProductionAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("kesim_talepleri")
    .select("talep_adet, kesilen_adet")
    .eq("plaka_id", plakaId)
    .in("durum", ["bekliyor", "kesimde"]);

  const rows = (data ?? []) as { talep_adet: number; kesilen_adet: number }[];
  return {
    adet: rows.length,
    toplam: rows.reduce((s, r) => s + Math.max(0, r.talep_adet - r.kesilen_adet), 0),
  };
}

export async function createKesimTalebi(formData: {
  sku: string;
  plaka_id: string;
  talep_adet: number;
  oncelik: "normal" | "acil";
  talep_notu: string | null;
}): Promise<ActionResult & { talep_id?: string }> {
  try {
    const user = await requireProductionAccess();

    if (!formData.sku || !formData.plaka_id) {
      return { success: false, error: "Ürün ve plaka seçimi gereklidir" };
    }
    if (!Number.isFinite(formData.talep_adet) || formData.talep_adet < 1) {
      return { success: false, error: "Plaka adedi en az 1 olmalıdır" };
    }

    const supabase = await createClient();

    // TAL-YYYYMMDD-HHMMSS
    const now = new Date();
    const p = (n: number, l = 2) => String(n).padStart(l, "0");
    const talepId = `TAL-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;

    const { data, error } = await supabase
      .from("kesim_talepleri")
      .insert({
        talep_id: talepId,
        sku: formData.sku,
        plaka_id: formData.plaka_id,
        talep_adet: Math.trunc(formData.talep_adet),
        oncelik: formData.oncelik,
        talep_eden: user.user_id,
        talep_notu: formData.talep_notu?.trim() || null,
      })
      .select("talep_id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Talep kaydedilemedi — yetkiniz olmayabilir" };
    }

    revalidatePath("/uretim/kesim");
    revalidatePath("/uretim/kesim/talepler");
    return { success: true, talep_id: talepId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Talebi iptal eder — kesilen adet varsa kayıt kalır, sadece durumu değişir */
export async function iptalKesimTalebi(talepId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("kesim_talepleri")
      .update({ durum: "iptal" })
      .eq("talep_id", talepId)
      .in("durum", ["bekliyor", "kesimde"])
      .select("talep_id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Talep iptal edilemedi — tamamlanmış olabilir veya yetkiniz yok",
      };
    }

    revalidatePath("/uretim/kesim");
    revalidatePath("/uretim/kesim/talepler");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Kesim Düzeltme / Silme ─────────────────────────────────

/**
 * Bir kesim kaydının bıraktığı tüm izleri geri alır.
 *
 * Kesim oluşturmak beş yerde etki bırakıyor:
 *   1. cut_lines            — çıkan parça satırları
 *   2. yari_mamul_stok      — parçalar için IN kayıtları
 *   3. all_parts            — MDF stoğundan düşüm
 *   4. hazir_eleman_akis    — MDF hareket kaydı
 *   5. kesim_talepleri      — talebe işlenen adet (trigger)
 *
 * Sadece cut_batches satırını silmek stoğu bozar; bu yüzden hepsi
 * sırayla geri alınıyor. Talep geri alma trigger ile yapılıyor.
 */
async function kesimEtkileriniGeriAl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cutId: string,
  plakaId: string | null,
  adet: number,
  operatorId: string | null
): Promise<string | null> {
  // 1. Yarı mamül IN kayıtlarını sil
  const { error: ymsError } = await supabase
    .from("yari_mamul_stok")
    .delete()
    .eq("source", "Kesim")
    .eq("source_id", cutId);
  if (ymsError) return `Yarı mamül hareketleri geri alınamadı: ${ymsError.message}`;

  // 2. Kesim satırlarını sil
  const { error: linesError } = await supabase
    .from("cut_lines")
    .delete()
    .eq("cut_id", cutId);
  if (linesError) return `Kesim satırları silinemedi: ${linesError.message}`;

  // 3. MDF stoğunu iade et
  if (plakaId && adet > 0) {
    const { data: plakaData } = await supabase
      .from("plakalar")
      .select("tipi, renk")
      .eq("plaka_id", plakaId)
      .maybeSingle();

    if (plakaData?.tipi && plakaData?.renk) {
      const { data: mdfPart } = await supabase
        .from("all_parts")
        .select("part_id, hazir_eleman_aktif_stok")
        .eq("mdf_tipi", plakaData.tipi)
        .eq("mdf_renk", plakaData.renk)
        .maybeSingle();

      if (mdfPart) {
        await supabase
          .from("all_parts")
          .update({ hazir_eleman_aktif_stok: mdfPart.hazir_eleman_aktif_stok + adet })
          .eq("part_id", mdfPart.part_id);

        // İade hareketi — denetim izi kalsın, sessizce düzeltilmesin
        const n = new Date();
        const p = (v: number) => String(v).padStart(2, "0");
        await supabase.from("hazir_eleman_akis").insert({
          hakis_id: `HA-IADE-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${cutId}`,
          tarih: n.toISOString(),
          part_id: mdfPart.part_id,
          qty: adet,
          operator: operatorId,
          not_text: `Kesim iptali — ${cutId} silindi, MDF iade edildi`,
        });
      }
    }
  }

  return null;
}

/** Kesim kaydını ve tüm yan etkilerini siler */
export async function deleteCutBatch(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("cut_batches")
      .select("cut_id, plaka_id, adet, operator_id")
      .eq("cut_id", cutId)
      .maybeSingle();

    const batch = data as {
      cut_id: string;
      plaka_id: string | null;
      adet: number;
      operator_id: string | null;
    } | null;
    if (!batch) return { success: false, error: "Kesim kaydı bulunamadı" };

    const hata = await kesimEtkileriniGeriAl(
      supabase,
      cutId,
      batch.plaka_id,
      Number(batch.adet) || 0,
      batch.operator_id
    );
    if (hata) return { success: false, error: hata };

    // Talep geri alma AFTER DELETE trigger ile yapılıyor
    const { data: silinen, error } = await supabase
      .from("cut_batches")
      .delete()
      .eq("cut_id", cutId)
      .select("cut_id");

    if (error) return { success: false, error: error.message };
    if (!silinen || silinen.length === 0) {
      return {
        success: false,
        error: "Kesim silinemedi — bu işlem için yetkiniz olmayabilir",
      };
    }

    revalidatePath("/uretim/kesim");
    revalidatePath("/uretim/kesim/talepler");
    revalidatePath("/stok/yari-mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/**
 * Kesim kaydını günceller.
 *
 * Adet değişirse çıkan parçalar, yarı mamül girişleri ve MDF düşümü
 * yeniden hesaplanır. Ürün veya plaka değişimi desteklenmiyor — o
 * durumda kayıt silinip yeniden oluşturulmalı, çünkü çıkan parça
 * kümesi tamamen değişir.
 */
export async function updateCutBatch(
  cutId: string,
  formData: {
    adet: number;
    makine_id: string;
    operator_id: string;
    plk_notu: string | null;
    /**
     * Kesimin gerçekte yapıldığı gün (ISO). Kayıt çoğu zaman birkaç gün
     * sonra giriliyor; verilmezse mevcut tarih korunur.
     */
    tarih?: string;
  }
): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    if (!Number.isFinite(formData.adet) || formData.adet < 1) {
      return { success: false, error: "Adet en az 1 olmalıdır" };
    }
    if (!KESIM_MAKINE_IDS.includes(formData.makine_id as (typeof KESIM_MAKINE_IDS)[number])) {
      return { success: false, error: "Geçersiz makine" };
    }

    const { data } = await supabase
      .from("cut_batches")
      .select("cut_id, sku, plaka_id, adet, operator_id, email, tarih")
      .eq("cut_id", cutId)
      .maybeSingle();

    const batch = data as {
      cut_id: string;
      sku: string;
      plaka_id: string | null;
      adet: number;
      operator_id: string | null;
      email: string | null;
      tarih: string;
    } | null;
    if (!batch) return { success: false, error: "Kesim kaydı bulunamadı" };

    // Yeni tarih verilmediyse mevcut korunur
    const yeniTarih = formData.tarih || batch.tarih;
    const tarihDegisti = yeniTarih !== batch.tarih;

    const eskiAdet = Number(batch.adet) || 0;
    const yeniAdet = Math.trunc(formData.adet);

    // Adet değiştiyse türetilen kayıtları yeniden üret
    if (yeniAdet !== eskiAdet && batch.plaka_id) {
      const hata = await kesimEtkileriniGeriAl(
        supabase,
        cutId,
        batch.plaka_id,
        eskiAdet,
        batch.operator_id
      );
      if (hata) return { success: false, error: hata };

      const { data: plakaParts } = await supabase
        .from("plaka_parts")
        .select("part_id, default_qty")
        .eq("plaka_id", batch.plaka_id);

      const parcalar = (plakaParts ?? []) as { part_id: string; default_qty: number | null }[];
      /**
       * Türetilen satırlar kaydın girildiği ana değil, kesimin yapıldığı
       * güne yazılıyor. Aksi halde parti 12 Ağustos'ta görünürken satırları
       * 14 Ağustos'ta çıkar ve analizler ikiye bölünür.
       */
      const now = yeniTarih;

      if (parcalar.length > 0) {
        const { data: adlar } = await supabase
          .from("all_parts")
          .select("part_id, part_adi")
          .in("part_id", parcalar.map((p) => p.part_id));
        const adMap = new Map((adlar ?? []).map((a) => [a.part_id, a.part_adi]));

        await supabase.from("cut_lines").insert(
          parcalar.map((pp, i) => ({
            cut_line_id: `K-${cutId}-${String(i + 1).padStart(3, "0")}`,
            cut_id: cutId,
            tarih: now,
            part_id: pp.part_id,
            adet: (pp.default_qty ?? 0) * yeniAdet,
            email: batch.email,
          }))
        );

        await supabase.from("yari_mamul_stok").insert(
          parcalar.map((pp, i) => ({
            yms_id: `YMS-${cutId}-${String(i + 1).padStart(3, "0")}`,
            tarih: now,
            part_id: pp.part_id,
            part_adi: adMap.get(pp.part_id) ?? null,
            sku: batch.sku,
            qty: (pp.default_qty ?? 0) * yeniAdet,
            direction: "IN",
            source: "Kesim",
            source_id: cutId,
            operator: formData.operator_id,
          }))
        );
      }

      // MDF'yi yeni adete göre tekrar düş
      const { data: plakaData } = await supabase
        .from("plakalar")
        .select("tipi, renk")
        .eq("plaka_id", batch.plaka_id)
        .maybeSingle();

      if (plakaData?.tipi && plakaData?.renk) {
        const { data: mdfPart } = await supabase
          .from("all_parts")
          .select("part_id, hazir_eleman_aktif_stok")
          .eq("mdf_tipi", plakaData.tipi)
          .eq("mdf_renk", plakaData.renk)
          .maybeSingle();

        if (mdfPart) {
          await supabase
            .from("all_parts")
            .update({ hazir_eleman_aktif_stok: mdfPart.hazir_eleman_aktif_stok - yeniAdet })
            .eq("part_id", mdfPart.part_id);
        }
      }
    }

    // Talep adet düzeltmesi UPDATE OF adet trigger'ı ile yapılıyor
    const { data: guncellenen, error } = await supabase
      .from("cut_batches")
      .update({
        adet: yeniAdet,
        makine_id: formData.makine_id,
        operator_id: formData.operator_id,
        plk_notu: formData.plk_notu?.trim() || null,
        tarih: yeniTarih,
        baslama_zamani: yeniTarih,
        bitis_zamani: yeniTarih,
      })
      .eq("cut_id", cutId)
      .select("cut_id");

    if (error) return { success: false, error: error.message };
    if (!guncellenen || guncellenen.length === 0) {
      return {
        success: false,
        error: "Kesim güncellenemedi — bu işlem için yetkiniz olmayabilir",
      };
    }

    /**
     * Tarih değiştiyse bağlı kayıtlar da taşınır. Kesim satırı partisinden
     * farklı bir güne düşerse üretim raporları tutarsız olur — satırın
     * partisiyle aynı günde olması korunması gereken bir kural.
     * Adet değiştiyse satırlar zaten yeni tarihle yeniden üretildi.
     */
    if (tarihDegisti && yeniAdet === eskiAdet) {
      await supabase.from("cut_lines").update({ tarih: yeniTarih }).eq("cut_id", cutId);
      await supabase.from("yari_mamul_stok").update({ tarih: yeniTarih }).eq("source_id", cutId);
    }

    revalidatePath("/uretim/kesim");
    revalidatePath("/uretim/kesim/talepler");
    revalidatePath("/stok/yari-mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ═══════════════════════════════════════════════════════════════
// KESİM RAPORU / ANALİZ
//
// ÖNEMLİ KISIT: Kesimlerde gerçek başlangıç/bitiş süresi tutulmuyor
// (baslama_zamani = bitis_zamani). Bu yüzden "verimlilik" (gerçek ÷
// standart) HESAPLANAMAZ. Tüm süre analizi PLANLI YÜK üzerinden:
// plakanın makine standart süresi (dakika) × kesilen adet.
// Ekranda bu açıkça "planlı" olarak etiketleniyor, yanlış okunmasın.
// ═══════════════════════════════════════════════════════════════

export interface MakineYuk {
  makine: string;
  kesim: number;
  plaka: number;
  saat: number;   // planlı makine-saati
  pay: number;    // toplam içindeki % pay
}

export interface MdfSatiri {
  ad: string;
  plaka: number;
  kesim: number;
}

export interface PlakaPareto {
  plakaId: string;
  ad: string;
  urun: string;
  plaka: number;
  saat: number;       // planlı makine-saati
  kumulatif: number;  // kümülatif %
}

export interface OperatorSatiri {
  ad: string;
  kesim: number;
  plaka: number;
  saat: number;
}

export interface ParcaKarsilastirma {
  partId: string;
  ad: string;
  kesilen: number;
  tuketilen: number;
  bakiye: number;
}

export interface KesimAnalizi {
  kpi: { kesim: number; plaka: number; makineSaati: number; uretilenParca: number };
  makineYuku: MakineYuk[];
  mdfTip: MdfSatiri[];
  mdfRenk: MdfSatiri[];
  plakaPareto: PlakaPareto[];
  operatorler: OperatorSatiri[];
  parcalar: ParcaKarsilastirma[];
  gunSayisi: number;
}

export async function getKesimAnaliz(donemKodu: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !URETIM_ANALIZ_ROLES.includes(user.role)) {
      return { success: false as const, error: "Bu analizi görme yetkiniz yok" };
    }
    const supabase = await createClient();
    const aralik = donemAraligi(donemKodu) ?? donemAraligi("tum")!;
    const basISO = aralik.bas.toISOString();
    const bitISO = aralik.bit.toISOString();

    // ── Kesim partileri + plaka bilgisi ──────────────────────
    const { data: batchData, error } = await supabase
      .from("cut_batches")
      .select("cut_id, tarih, sku, plaka_id, makine_id, adet, operator_id")
      .eq("durum", "tamamlandi")
      .gte("tarih", basISO)
      .lt("tarih", bitISO);
    if (error) return { success: false as const, error: error.message };

    type Batch = {
      cut_id: string; tarih: string | null; sku: string | null;
      plaka_id: string | null; makine_id: string | null;
      adet: number; operator_id: string | null;
    };
    const batches = (batchData ?? []) as Batch[];

    // Plaka meta (standart süre, tip, renk, ad)
    const plakaIds = [...new Set(batches.map((b) => b.plaka_id).filter(Boolean) as string[])];
    type Plaka = {
      plaka_id: string; plaka_adi: string | null; tipi: string | null;
      renk: string | null; kesim_sureleri: Record<string, number> | null;
    };
    const plakaMeta = new Map<string, Plaka>();
    for (let i = 0; i < plakaIds.length; i += 200) {
      const { data } = await supabase
        .from("plakalar")
        .select("plaka_id, plaka_adi, tipi, renk, kesim_sureleri")
        .in("plaka_id", plakaIds.slice(i, i + 200));
      for (const p of (data ?? []) as Plaka[]) plakaMeta.set(p.plaka_id, p);
    }

    // Standart dakika: plakanın o makinedeki süresi
    const stdDk = (plakaId: string | null, makine: string | null): number => {
      if (!plakaId || !makine) return 0;
      const m = plakaMeta.get(plakaId)?.kesim_sureleri;
      const v = m && typeof m === "object" ? Number(m[makine]) : 0;
      return Number.isFinite(v) ? v : 0;
    };

    // ── Toplama ──────────────────────────────────────────────
    const makine = new Map<string, { kesim: number; plaka: number; dk: number }>();
    const mdfTipM = new Map<string, { plaka: number; kesim: number }>();
    const mdfRenkM = new Map<string, { plaka: number; kesim: number }>();
    const plakaM = new Map<string, { ad: string; urun: string; plaka: number; dk: number }>();
    const opM = new Map<string, { plaka: number; kesim: number; dk: number }>();
    const gunSet = new Set<string>();
    let toplamDk = 0;

    for (const b of batches) {
      const dk = stdDk(b.plaka_id, b.makine_id) * (b.adet ?? 0);
      toplamDk += dk;
      if (b.tarih) gunSet.add(b.tarih.slice(0, 10));

      const mk = b.makine_id ?? "?";
      const m = makine.get(mk) ?? { kesim: 0, plaka: 0, dk: 0 };
      m.kesim++; m.plaka += b.adet ?? 0; m.dk += dk;
      makine.set(mk, m);

      const meta = b.plaka_id ? plakaMeta.get(b.plaka_id) : undefined;
      const tip = meta?.tipi ?? "(belirsiz)";
      const t = mdfTipM.get(tip) ?? { plaka: 0, kesim: 0 };
      t.plaka += b.adet ?? 0; t.kesim++;
      mdfTipM.set(tip, t);

      const renk = meta?.renk ?? "(belirsiz)";
      const rk = mdfRenkM.get(renk) ?? { plaka: 0, kesim: 0 };
      rk.plaka += b.adet ?? 0; rk.kesim++;
      mdfRenkM.set(renk, rk);

      if (b.plaka_id) {
        const p = plakaM.get(b.plaka_id) ?? {
          ad: meta?.plaka_adi ?? b.plaka_id, urun: b.sku ?? "—", plaka: 0, dk: 0,
        };
        p.plaka += b.adet ?? 0; p.dk += dk;
        plakaM.set(b.plaka_id, p);
      }

      const op = b.operator_id ?? "(atanmamış)";
      const o = opM.get(op) ?? { plaka: 0, kesim: 0, dk: 0 };
      o.plaka += b.adet ?? 0; o.kesim++; o.dk += dk;
      opM.set(op, o);
    }

    // Operatör adları
    const opIds = [...opM.keys()].filter((x) => x !== "(atanmamış)");
    const opAd = new Map<string, string>();
    if (opIds.length > 0) {
      const { data } = await supabase.from("users").select("user_id, full_name").in("user_id", opIds);
      for (const u of (data ?? []) as { user_id: string; full_name: string | null }[]) {
        if (u.full_name) opAd.set(u.user_id, u.full_name);
      }
    }

    // ── Üretilen parça (cut_lines, dönem içi) ─────────────────
    const cutIds = batches.map((b) => b.cut_id);
    let uretilenParca = 0;
    for (let i = 0; i < cutIds.length; i += 300) {
      const { data } = await supabase
        .from("cut_lines").select("adet").in("cut_id", cutIds.slice(i, i + 300));
      for (const l of (data ?? []) as { adet: number | null }[]) uretilenParca += Number(l.adet ?? 0);
    }

    // ── Parça karşılaştırması: kesilen (IN/Kesim) vs tüketilen (OUT/Montaj) ──
    // Dönem filtresi tarih üzerinden.
    const { data: ymsData } = await supabase
      .from("yari_mamul_stok")
      .select("part_id, part_adi, qty, direction, source")
      .gte("tarih", basISO)
      .lt("tarih", bitISO);
    const parcaM = new Map<string, { ad: string; kesilen: number; tuketilen: number }>();
    for (const y of (ymsData ?? []) as {
      part_id: string | null; part_adi: string | null; qty: number;
      direction: string | null; source: string | null;
    }[]) {
      if (!y.part_id) continue;
      const p = parcaM.get(y.part_id) ?? { ad: y.part_adi ?? y.part_id, kesilen: 0, tuketilen: 0 };
      const q = Math.abs(Number(y.qty ?? 0));
      if (y.direction === "IN") p.kesilen += q;
      else if (y.direction === "OUT") p.tuketilen += q;
      parcaM.set(y.part_id, p);
    }

    // ── Sonuç şekillendirme ──────────────────────────────────
    const makineYuku: MakineYuk[] = [...makine.entries()]
      .map(([m, v]) => ({
        makine: m, kesim: v.kesim, plaka: Math.round(v.plaka),
        saat: Number((v.dk / 60).toFixed(1)),
        pay: toplamDk > 0 ? Math.round((v.dk / toplamDk) * 100) : 0,
      }))
      .sort((a, b) => b.saat - a.saat);

    const mdfSirala = (m: Map<string, { plaka: number; kesim: number }>): MdfSatiri[] =>
      [...m.entries()].map(([ad, v]) => ({ ad, plaka: Math.round(v.plaka), kesim: v.kesim }))
        .sort((a, b) => b.plaka - a.plaka);

    const plakaSirali = [...plakaM.entries()].sort((a, b) => b[1].dk - a[1].dk);
    let birikim = 0;
    const plakaPareto: PlakaPareto[] = plakaSirali.slice(0, 15).map(([id, v]) => {
      birikim += v.dk;
      return {
        plakaId: id, ad: v.ad, urun: v.urun, plaka: Math.round(v.plaka),
        saat: Number((v.dk / 60).toFixed(1)),
        kumulatif: toplamDk > 0 ? Number(((birikim / toplamDk) * 100).toFixed(1)) : 0,
      };
    });

    const operatorler: OperatorSatiri[] = [...opM.entries()]
      .map(([id, v]) => ({
        ad: id === "(atanmamış)" ? "Atanmamış" : (opAd.get(id) ?? id),
        kesim: v.kesim, plaka: Math.round(v.plaka), saat: Number((v.dk / 60).toFixed(1)),
      }))
      .sort((a, b) => b.plaka - a.plaka);

    const parcalar: ParcaKarsilastirma[] = [...parcaM.entries()]
      .map(([id, v]) => ({
        partId: id, ad: v.ad, kesilen: Math.round(v.kesilen),
        tuketilen: Math.round(v.tuketilen), bakiye: Math.round(v.kesilen - v.tuketilen),
      }))
      .filter((x) => x.kesilen > 0 || x.tuketilen > 0)
      .sort((a, b) => (b.kesilen + b.tuketilen) - (a.kesilen + a.tuketilen));

    return {
      success: true as const,
      data: {
        kpi: {
          kesim: batches.length,
          plaka: Math.round(batches.reduce((t, b) => t + (b.adet ?? 0), 0)),
          makineSaati: Number((toplamDk / 60).toFixed(0)),
          uretilenParca: Math.round(uretilenParca),
        },
        makineYuku, mdfTip: mdfSirala(mdfTipM), mdfRenk: mdfSirala(mdfRenkM),
        plakaPareto, operatorler, parcalar, gunSayisi: gunSet.size,
      } satisfies KesimAnalizi,
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
