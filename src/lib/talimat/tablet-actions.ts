"use server";

/**
 * Tablet (P4c) yardımcı action'ları: istasyon bağlamı + kesim "Bitirdi" ön doldurma.
 * Çekirdek API (actions.ts) değiştirilmez; yalnız kullanılır.
 */
import { getCurrentUserWithAuth } from "@/lib/auth";
import { STATION_EMAILS } from "@/lib/constants";
import { TALIMAT_PERSONEL_ROLES, TALIMAT_VIEW_ROLES } from "./constants";
import { isStationEmail } from "@/lib/constants";
import { sonucaCevir, talimatDb } from "./db";
import { getKesimOnDoldurma } from "./queries";
import type { ActionResult, KesimOnDoldurma } from "./types";

export interface TabletPersonel {
  user_id: string;
  full_name: string;
}

export interface TabletKontekst {
  userId: string;
  operatorId: string | null;
  operatorName: string | null;
  role: string;
  station: string | null;
  /** Ortak istasyon hesabı (kesim@, montaj@ ...) */
  istasyonHesabi: boolean;
  /** Liste/bildirim için ilgili personeller (istasyon personeli; istasyonu yoksa tüm Üretim/Hat) */
  personeller: TabletPersonel[];
  /** Varsayılan personel: seçili operatör, yoksa kullanıcının kendisi (Üretim/Hat ise) */
  varsayilanPersonelId: string | null;
}

/** "Montaj Hattı" -> "Montaj" */
function istasyonTaban(station: string | null | undefined): string | null {
  if (!station) return null;
  return station.replace(/\s+Hattı$/, "").replace(/^Temilik$/, "Temizlik");
}

export async function tabletKontekstGetir(): Promise<ActionResult<TabletKontekst>> {
  return sonucaCevir(async () => {
    const ctx = await getCurrentUserWithAuth();
    if (!ctx || !(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) {
      throw new Error("Yetkisiz erişim");
    }
    const { profile, auth } = ctx;
    const taban = istasyonTaban(profile.station);
    const uretimIstasyonlari = ["Kesim", "Temizlik", "Montaj", "Paketleme", "Kutu"];

    const sb = await talimatDb();
    let q = sb
      .from("users")
      .select("user_id, full_name, station, email")
      .in("role", TALIMAT_PERSONEL_ROLES)
      .eq("is_active", true)
      .order("full_name");
    if (taban && uretimIstasyonlari.includes(taban)) {
      q = q.in("station", [taban, `${taban} Hattı`]);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const personeller = (data ?? []).filter((u) => !isStationEmail((u.email as string | null) ?? undefined)).map((u) => ({ user_id: u.user_id as string, full_name: (u.full_name as string) ?? (u.user_id as string) }));

    const kendisiPersonel = (TALIMAT_PERSONEL_ROLES as readonly string[]).includes(profile.role);
    return {
      userId: profile.user_id,
      operatorId: auth.operatorId ?? null,
      operatorName: auth.operatorName ?? null,
      role: profile.role,
      station: profile.station ?? null,
      istasyonHesabi: STATION_EMAILS.includes(profile.email as (typeof STATION_EMAILS)[number]),
      personeller,
      varsayilanPersonelId: auth.operatorId ?? (kendisiPersonel ? profile.user_id : null),
    };
  });
}

export interface KesimBitirdiVerisi extends KesimOnDoldurma {
  plaka_adi: string | null;
  personel_adi: string | null;
}

/**
 * Kesim "Bitirdi": plaka + adet ön doldurma. Satırda sku yoksa plakanın ilk SKU'su kullanılır.
 */
export async function kesimBitirdiVerisiGetir(satirId: string): Promise<ActionResult<KesimBitirdiVerisi | null>> {
  return sonucaCevir(async () => {
    const ctx = await getCurrentUserWithAuth();
    if (!ctx || !(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) {
      throw new Error("Yetkisiz erişim");
    }
    const v = await getKesimOnDoldurma(satirId);
    if (!v) return null;
    const sb = await talimatDb();
    let sku = v.sku;
    let plakaAdi: string | null = null;
    if (v.plaka_id) {
      const { data } = await sb.from("plakalar").select("plaka_adi, sku").eq("plaka_id", v.plaka_id).limit(1).maybeSingle();
      plakaAdi = (data?.plaka_adi as string | null) ?? null;
      if (!sku) {
        const skular = (data?.sku as string[] | null) ?? [];
        sku = skular[0] ?? null;
      }
    }
    const { data: u } = await sb.from("users").select("full_name").eq("user_id", v.personel_id).maybeSingle();
    return { ...v, sku, plaka_adi: plakaAdi, personel_adi: (u?.full_name as string | null) ?? null };
  });
}
