"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readOperatorId, readOperatorName } from "@/lib/supabase/schema";
import { ADMIN_ROLES, PRODUCTION_ACCESS_ROLES, STOCK_ACCESS_ROLES } from "@/lib/constants";
import type {
  KaliteItemTipi,
  KaliteKaynak,
  KaliteItemOption,
  UrunParcasi,
  DepoOption,
  KaliteKayit,
  KaliteKayitTipi,
} from "./types";

type Res<T = undefined> = T extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string };

async function requireAccess() {
  const user = await getCurrentUser();
  if (
    !user ||
    !(
      (PRODUCTION_ACCESS_ROLES as readonly string[]).includes(user.role) ||
      (STOCK_ACCESS_ROLES as readonly string[]).includes(user.role)
    )
  ) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

async function getOperator() {
  const user = await requireAccess();
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const meta = authUser?.user_metadata ?? {};
  return {
    supabase,
    operatorId: readOperatorId(meta) ?? user.user_id,
    operatorName: readOperatorName(meta) ?? user.full_name ?? null,
  };
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Bir hata oluştu";
}

type SB = Awaited<ReturnType<typeof createClient>>;

// kalite_* RPC'leri henüz üretilmiş tiplerde yok
async function callRpc(supabase: SB, name: string, args: Record<string, unknown>): Promise<Res> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) return { success: false, error: error.message };
  const d = data as { ok?: boolean } | null;
  if (d && d.ok === false) return { success: false, error: "İşlem başarısız" };
  return { success: true };
}

function revalidateAll() {
  for (const p of [
    "/uretim/kesim",
    "/uretim/montaj",
    "/uretim/paketleme",
    "/stok/mamul",
    "/stok/yari-mamul",
    "/stok/hazir-eleman",
    "/stok/iade",
  ]) {
    revalidatePath(p);
  }
}

// ─── OKUMA ──────────────────────────────────────────────────────

/** Kalem arama (ürün: sku/ad, yarı mamul/plaka: part_id/ad) */
export async function searchItems(
  query: string,
  tipi: KaliteItemTipi
): Promise<Res<KaliteItemOption[]>> {
  try {
    await requireAccess();
    const supabase = await createClient();
    const q = query.trim().replace(/[%,()]/g, " ");

    if (tipi === "URUN") {
      let qb = supabase.from("products").select("sku, urun_adi, stok_aktif").order("sku").limit(40);
      if (q) qb = qb.or(`sku.ilike.%${q}%,urun_adi.ilike.%${q}%`);
      const { data, error } = await qb;
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: (data ?? []).map((p) => ({ id: p.sku, adi: p.urun_adi, stok: p.stok_aktif })),
      };
    }

    let qb = supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type, yari_mamul_stok, hazir_eleman_aktif_stok")
      .order("part_id")
      .limit(40);
    if (tipi === "YARI_MAMUL") qb = qb.eq("part_type", "YARIMAMUL");
    else qb = qb.not("mdf_tipi", "is", null);
    if (q) qb = qb.or(`part_id.ilike.%${q}%,part_adi.ilike.%${q}%`);
    const { data, error } = await qb;
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: (data ?? []).map((p) => ({
        id: p.part_id,
        adi: p.part_adi,
        partType: p.part_type,
        stok: tipi === "YARI_MAMUL" ? p.yari_mamul_stok : p.hazir_eleman_aktif_stok,
      })),
    };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

/** Uygunsuz bakiyesi > 0 olan kalemler (kontrol ekranı yalnızca bunları listeler) */
export async function listUygunsuzItems(
  tipi: KaliteItemTipi
): Promise<Res<KaliteItemOption[]>> {
  try {
    await requireAccess();
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("kalite_bakiye")
      .select("item_id, item_adi, uygunsuz_bakiye")
      .eq("item_tipi", tipi)
      .gt("uygunsuz_bakiye", 0)
      .order("item_id");
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as { item_id: string; item_adi: string | null; uygunsuz_bakiye: number }[]).map(
        (r) => ({ id: r.item_id, adi: r.item_adi, uygunsuz: Number(r.uygunsuz_bakiye) })
      ),
    };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

/** Ürünün yarı mamul + hazır eleman dökümü (BOM açılımı) */
export async function getUrunYariMamulleri(sku: string): Promise<Res<UrunParcasi[]>> {
  try {
    await requireAccess();
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("urun_yari_mamul_listesi", { p_sku: sku });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as UrunParcasi[]).map((r) => ({ ...r, qty_per: Number(r.qty_per) })),
    };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

/** Montaj adımının yarı mamul parçaları (kapanışta fire girişi için) */
export async function getStepParts(
  stepId: string
): Promise<Res<{ part_id: string; part_adi: string | null; qty_per: number }[]>> {
  try {
    await requireAccess();
    const supabase = await createClient();
    const { data: bom, error } = await supabase
      .from("step_bom")
      .select("part_id, qty_per")
      .eq("step_id", stepId);
    if (error) return { success: false, error: error.message };
    const ids = [
      ...new Set((bom ?? []).filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id)),
    ];
    if (ids.length === 0) return { success: true, data: [] };
    const { data: parts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .eq("part_type", "YARIMAMUL")
      .in("part_id", ids);
    const qtyMap = new Map<string, number>();
    for (const b of bom ?? []) qtyMap.set(b.part_id, (qtyMap.get(b.part_id) ?? 0) + Number(b.qty_per));
    return {
      success: true,
      data: (parts ?? [])
        .map((p) => ({ part_id: p.part_id, part_adi: p.part_adi, qty_per: qtyMap.get(p.part_id) ?? 1 }))
        .sort((a, b) => a.part_id.localeCompare(b.part_id)),
    };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

export async function listDepolar(): Promise<Res<DepoOption[]>> {
  try {
    await requireAccess();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("depolar")
      .select("depo_id, ad")
      .eq("aktif", true)
      .order("sira");
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as DepoOption[] };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

// ─── YAZMA ──────────────────────────────────────────────────────

export async function uygunsuzGiris(input: {
  itemTipi: "URUN" | "YARI_MAMUL";
  itemId: string;
  qty: number;
  kaynak: KaliteKaynak;
  stoktanDus: boolean;
  depoId?: string | null;
  not?: string | null;
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    if (!input.itemId) return { success: false, error: "Kalem seçiniz" };
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      return { success: false, error: "Geçerli bir adet giriniz" };
    }
    const r = await callRpc(supabase, "kalite_uygunsuz_giris", {
      p_item_tipi: input.itemTipi,
      p_item_id: input.itemId,
      p_qty: input.qty,
      p_kaynak: input.kaynak,
      p_stoktan_dus: input.stoktanDus,
      p_depo_id: input.depoId ?? null,
      p_source_id: null,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_kargo: null,
      p_musteri: null,
      p_not: input.not ?? null,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

export async function kontrolUygun(input: {
  itemTipi: "URUN" | "YARI_MAMUL";
  itemId: string;
  qty: number;
  depoId?: string | null;
  not?: string | null;
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      return { success: false, error: "Geçerli bir adet giriniz" };
    }
    if (input.itemTipi === "URUN" && !input.depoId) return { success: false, error: "Depo seçiniz" };
    const r = await callRpc(supabase, "kalite_kontrol_uygun", {
      p_item_tipi: input.itemTipi,
      p_item_id: input.itemId,
      p_qty: input.qty,
      p_depo_id: input.depoId ?? null,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_not: input.not ?? null,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

export async function kontrolSokum(input: {
  sku: string;
  qty: number;
  parts: { part_id: string; saglam: number; fire: number }[];
  not?: string | null;
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      return { success: false, error: "Geçerli bir adet giriniz" };
    }
    const r = await callRpc(supabase, "kalite_sokum", {
      p_sku: input.sku,
      p_qty: input.qty,
      p_parts: input.parts.filter((p) => p.saglam > 0 || p.fire > 0),
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_not: input.not ?? null,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

export async function fireGiris(input: {
  itemTipi: KaliteItemTipi;
  itemId: string;
  qty?: number | null;
  kaynak: KaliteKaynak;
  stoktanDus: boolean;
  depoId?: string | null;
  parts?: { part_id: string; qty: number }[] | null;
  fromUygunsuz?: boolean;
  not?: string | null;
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    const parts = (input.parts ?? []).filter((p) => p.qty > 0);
    const hasParts = parts.length > 0;
    if (!hasParts && (!input.qty || !Number.isFinite(input.qty) || input.qty <= 0)) {
      return { success: false, error: "Geçerli bir miktar giriniz" };
    }
    const r = await callRpc(supabase, "kalite_fire_giris", {
      p_item_tipi: input.itemTipi,
      p_item_id: input.itemId,
      p_qty: input.qty ?? null,
      p_kaynak: input.kaynak,
      p_stoktan_dus: input.stoktanDus,
      p_depo_id: input.depoId ?? null,
      p_parts: hasParts ? parts : null,
      p_from_uygunsuz: input.fromUygunsuz ?? false,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_not: input.not ?? null,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

export async function donusumYap(input: {
  kaynakPart: string;
  kaynakQty: number;
  hedefPart: string;
  uygunQty: number;
  uygunsuzQty: number;
  not?: string | null;
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    if (!input.kaynakPart || !input.hedefPart) {
      return { success: false, error: "Kaynak ve hedef parçayı seçiniz" };
    }
    if (!(input.kaynakQty > 0)) return { success: false, error: "Tüketilen miktarı giriniz" };
    if (!(input.uygunQty > 0 || input.uygunsuzQty > 0)) {
      return { success: false, error: "Üretilen uygun veya uygunsuz miktarı giriniz" };
    }
    const r = await callRpc(supabase, "kalite_donusum", {
      p_kaynak_part: input.kaynakPart,
      p_kaynak_qty: input.kaynakQty,
      p_hedef_part: input.hedefPart,
      p_uygun_qty: input.uygunQty || 0,
      p_uygunsuz_qty: input.uygunsuzQty || 0,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_not: input.not ?? null,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

/** Montaj seansı kapanışında parça bazlı fire (ek tüketim) */
export async function montajFire(input: {
  sessionId: string;
  stepId: string;
  parts: { part_id: string; qty: number }[];
}): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    const parts = input.parts.filter((p) => p.qty > 0);
    if (parts.length === 0) return { success: true };
    const r = await callRpc(supabase, "kalite_montaj_fire", {
      p_session_id: input.sessionId,
      p_step_id: input.stepId,
      p_parts: parts,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

// ─── KAYITLAR / İPTAL ───────────────────────────────────────────

const IPTAL_SURESI_MS = 24 * 60 * 60 * 1000;

/**
 * İstasyonun (oturum hesabının) son 7 gündeki kalite kayıtları.
 * tumu=true yalnızca yönetici/stok rolleri için tüm kullanıcıların kayıtlarını getirir.
 * canCancel: yönetici/mühendis her kaydı, diğerleri yalnızca kendi kaydını 24 saat içinde iptal eder
 * (sunucudaki kalite_iptal() aynı kuralı uygular; burası yalnızca buton gösterimi içindir).
 */
export async function listKaliteKayitlari(input: {
  tip: KaliteKayitTipi;
  tumu?: boolean;
}): Promise<Res<KaliteKayit[]>> {
  try {
    const user = await requireAccess();
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const uid = authUser?.id ?? null;
    const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
    const canSeeAll = isAdmin || (STOCK_ACCESS_ROLES as readonly string[]).includes(user.role);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qb = (supabase as any)
      .from("kalite_hareketleri")
      .select(
        "id, created_at, item_tipi, item_id, item_adi, stok_turu, qty, islem, kaynak, parent_id, operator_name, not_text, created_by"
      )
      .eq("iptal_edildi", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (input.tip === "uygunsuz") qb = qb.eq("islem", "giris");
    else if (input.tip === "fire") qb = qb.eq("islem", "fire_giris").eq("stok_turu", "FIRE");
    else
      qb = qb.or(
        "islem.in.(kontrol_uygun,sokum,donusum_kaynak),and(islem.eq.fire_giris,stok_turu.eq.UYGUNSUZ)"
      );

    if (!(input.tumu && canSeeAll) && uid) qb = qb.eq("created_by", uid);

    const { data, error } = await qb;
    if (error) return { success: false, error: error.message };

    type Row = Omit<KaliteKayit, "canCancel"> & { parent_id: string | null; created_by: string | null };
    const now = Date.now();
    const rows: KaliteKayit[] = ((data ?? []) as Row[])
      // Söküm kalanı gibi sistem tarafından üretilen çocuk satırlar ayrı kayıt değildir
      .filter((r) => !(r.parent_id && r.parent_id.startsWith("KLT-")))
      .map((r) => ({
        id: r.id,
        created_at: r.created_at,
        item_tipi: r.item_tipi,
        item_id: r.item_id,
        item_adi: r.item_adi,
        stok_turu: r.stok_turu,
        qty: Number(r.qty),
        islem: r.islem,
        kaynak: r.kaynak,
        operator_name: r.operator_name,
        not_text: r.not_text,
        canCancel:
          isAdmin ||
          (!!uid && r.created_by === uid && now - new Date(r.created_at).getTime() < IPTAL_SURESI_MS),
      }));
    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}

/** Kalite kaydını iptal eder; tüm stok etkilerini ters hareketle geri alır (kalite_iptal RPC) */
export async function kaliteIptal(input: { id: string; neden: string }): Promise<Res> {
  try {
    const { supabase, operatorId, operatorName } = await getOperator();
    if (!input.neden.trim()) return { success: false, error: "İptal nedenini yazınız" };
    const r = await callRpc(supabase, "kalite_iptal", {
      p_id: input.id,
      p_neden: input.neden.trim(),
      p_operator_id: operatorId,
      p_operator_name: operatorName,
    });
    if (r.success) revalidateAll();
    return r;
  } catch (e) {
    return { success: false, error: errMsg(e) };
  }
}
