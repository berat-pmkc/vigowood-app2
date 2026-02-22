import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SALES_CHANNELS,
  SALES_CHANNEL_LABELS,
  EXPORT_CHANNELS,
  SERVICE_SKUS,
  PAZARYERI_OPTIONS,
} from "@/lib/constants";
import type { PeriodType } from "@/app/(dashboard)/satis/actions";

// ─── Types ──────────────────────────────────────────────────────

export interface SalesChannel {
  id: string;
  label: string;
  ihracat: boolean;
}

export interface BasariEsikleri {
  warning: number;
  success: number;
}

export interface SalesSettings {
  kanallari: SalesChannel[];
  hizmetSkulari: string[];
  pazaryeriSecenekleri: string[];
  basariEsikleri: BasariEsikleri;
  varsayilanDonem: PeriodType;
}

// ─── Fallback values from constants.ts ──────────────────────────

const FALLBACK_KANALLARI: SalesChannel[] = SALES_CHANNELS.map((id) => ({
  id,
  label: SALES_CHANNEL_LABELS[id] || id,
  ihracat: (EXPORT_CHANNELS as readonly string[]).includes(id),
}));

const FALLBACK_HIZMET_SKULARI: string[] = [...SERVICE_SKUS];
const FALLBACK_PAZARYERI: string[] = [...PAZARYERI_OPTIONS];
const FALLBACK_BASARI_ESIKLERI: BasariEsikleri = { warning: 70, success: 100 };
const FALLBACK_VARSAYILAN_DONEM: PeriodType = "month";

// ─── DB Read ────────────────────────────────────────────────────

const SATIS_SETTINGS_KEYS = [
  "satis_kanallari",
  "hizmet_skulari",
  "pazaryeri_secenekleri",
  "satis_basari_esikleri",
  "satis_varsayilan_donem",
] as const;

export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...SATIS_SETTINGS_KEYS]);

    const map = new Map<string, unknown>();
    for (const row of data ?? []) {
      map.set(row.key, row.value);
    }

    // Parse kanallari
    let kanallari = FALLBACK_KANALLARI;
    const rawKanallari = map.get("satis_kanallari");
    if (Array.isArray(rawKanallari) && rawKanallari.length > 0) {
      kanallari = rawKanallari as SalesChannel[];
    }

    // Parse hizmet SKU'ları
    let hizmetSkulari = FALLBACK_HIZMET_SKULARI;
    const rawHizmet = map.get("hizmet_skulari");
    if (Array.isArray(rawHizmet) && rawHizmet.length > 0) {
      hizmetSkulari = rawHizmet as string[];
    }

    // Parse pazaryeri seçenekleri
    let pazaryeriSecenekleri = FALLBACK_PAZARYERI;
    const rawPazaryeri = map.get("pazaryeri_secenekleri");
    if (Array.isArray(rawPazaryeri) && rawPazaryeri.length > 0) {
      pazaryeriSecenekleri = rawPazaryeri as string[];
    }

    // Parse başarı eşikleri
    let basariEsikleri = FALLBACK_BASARI_ESIKLERI;
    const rawEsikler = map.get("satis_basari_esikleri");
    if (rawEsikler && typeof rawEsikler === "object" && "warning" in rawEsikler && "success" in rawEsikler) {
      basariEsikleri = rawEsikler as BasariEsikleri;
    }

    // Parse varsayılan dönem
    let varsayilanDonem = FALLBACK_VARSAYILAN_DONEM;
    const rawDonem = map.get("satis_varsayilan_donem");
    if (typeof rawDonem === "string" && ["today", "week", "month", "all"].includes(rawDonem)) {
      varsayilanDonem = rawDonem as PeriodType;
    }

    return {
      kanallari,
      hizmetSkulari,
      pazaryeriSecenekleri,
      basariEsikleri,
      varsayilanDonem,
    };
  } catch {
    // DB hatası durumunda fallback değerler
    return {
      kanallari: FALLBACK_KANALLARI,
      hizmetSkulari: FALLBACK_HIZMET_SKULARI,
      pazaryeriSecenekleri: FALLBACK_PAZARYERI,
      basariEsikleri: FALLBACK_BASARI_ESIKLERI,
      varsayilanDonem: FALLBACK_VARSAYILAN_DONEM,
    };
  }
}

// ─── Derived Helpers ────────────────────────────────────────────

/** Kanal ihracat kanalı mı? (settings parametreli) */
export function isExportChannelFromSettings(channel: string, channels: SalesChannel[]): boolean {
  const found = channels.find((c) => c.id === channel);
  if (found) return found.ihracat;
  // Fallback: HAS- prefix kontrolü
  return channel.startsWith("HAS-");
}

/** SKU bir hizmet SKU'su mu? (settings parametreli) */
export function isServiceSkuFromSettings(sku: string, hizmetSkulari: string[]): boolean {
  if (!sku) return false;
  const upper = sku.toUpperCase().trim();
  return hizmetSkulari.some((s) => upper === s || upper.startsWith(s + " "));
}
