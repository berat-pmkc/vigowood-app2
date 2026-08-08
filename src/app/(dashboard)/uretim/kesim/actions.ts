"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cutBatchCreateSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES, KESIM_MAKINE_IDS } from "@/lib/constants";
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
