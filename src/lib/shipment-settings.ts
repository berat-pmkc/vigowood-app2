import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SEVKIYAT_COUNTRIES,
  PALET_BOYUTLARI,
  PALET_WEIGHT_KG,
  KONTEYNER_TYPES,
  KONTEYNER_TYPE_LABELS,
  ARAC_TIPLERI,
  MALIYET_PARA_BIRIMLERI,
  FIRMA_TIPLERI,
  FIRMA_TIPI_LABELS,
  SEVKIYAT_STATUS,
  SEVKIYAT_STATUS_LABELS,
  SEVKIYAT_STATUS_COLORS,
  SEVKIYAT_STATUS_BORDER_COLORS,
} from "@/lib/constants";

// Re-export types and helpers from the shared types file
// so server components can import everything from one place
export type {
  ShipmentCountry,
  PaletAyarlari,
  KonteynerTipi,
  AracTipi,
  MaliyetField,
  MaliyetAyarlari,
  FirmaTipi,
  DurumEtiketi,
  KurAyarlari,
  ShipmentSettings,
} from "./shipment-settings-types";

export {
  getCountryByCode,
  getCountryMap,
  getKonteynerLabel,
  getDurumEtiketi,
  getFirmaTipiLabel,
} from "./shipment-settings-types";

import type {
  ShipmentCountry,
  PaletAyarlari,
  KonteynerTipi,
  AracTipi,
  MaliyetAyarlari,
  FirmaTipi,
  DurumEtiketi,
  KurAyarlari,
  ShipmentSettings,
} from "./shipment-settings-types";

// ─── Fallback values from constants.ts ──────────────────────────

const FALLBACK_ULKELER: ShipmentCountry[] = Object.values(SEVKIYAT_COUNTRIES).map((c) => ({
  code: c.code,
  name: c.name,
  nameEN: c.nameEN,
  currency: c.currency,
  currencySymbol: c.currencySymbol,
  port: c.port,
  buyer: c.buyer,
}));

const FALLBACK_PALET_AYARLARI: PaletAyarlari = {
  boyutlar: [...PALET_BOYUTLARI],
  paletWeightKg: PALET_WEIGHT_KG,
  defaultYukseklik: 125,
};

const FALLBACK_KONTEYNER_TIPLERI: KonteynerTipi[] = KONTEYNER_TYPES.map((t) => ({
  type: t,
  label: KONTEYNER_TYPE_LABELS[t],
}));

const FALLBACK_ARAC_TIPLERI: AracTipi[] = Object.entries(ARAC_TIPLERI).map(([id, label]) => ({
  id,
  label,
}));

const FALLBACK_MALIYET_AYARLARI: MaliyetAyarlari = {
  paraBirimleri: [...MALIYET_PARA_BIRIMLERI],
  fields: [
    { key: "navlun", label: "Navlun", defaultCurrency: "USD" },
    { key: "ic_nakliye", label: "İç Nakliye", defaultCurrency: "TRY" },
    { key: "ara_depo", label: "Ara Depo", defaultCurrency: "TRY" },
    { key: "amazon_pickup", label: "Amazon Pickup", defaultCurrency: "USD" },
    { key: "ydg", label: "YDG", defaultCurrency: "USD" },
    { key: "tr_gumruk", label: "TR Gümrük", defaultCurrency: "TRY" },
    { key: "diger", label: "Diğer", defaultCurrency: "TRY" },
  ],
  desiCarpani: 333.33,
};

const FALLBACK_FIRMA_TIPLERI: FirmaTipi[] = FIRMA_TIPLERI.map((id) => ({
  id,
  label: FIRMA_TIPI_LABELS[id],
}));

const FALLBACK_DURUM_ETIKETLERI: DurumEtiketi[] = SEVKIYAT_STATUS.map((id) => ({
  id,
  label: SEVKIYAT_STATUS_LABELS[id],
  bg: SEVKIYAT_STATUS_COLORS[id].bg,
  text: SEVKIYAT_STATUS_COLORS[id].text,
  border: SEVKIYAT_STATUS_COLORS[id].border,
  borderL: SEVKIYAT_STATUS_BORDER_COLORS[id],
}));

const FALLBACK_KUR_AYARLARI: KurAyarlari = {
  currencies: ["USD", "EUR", "GBP", "PLN", "SEK"],
};

// ─── DB Read ────────────────────────────────────────────────────

const SEVKIYAT_SETTINGS_KEYS = [
  "sevkiyat_ulkeler",
  "sevkiyat_palet_ayarlari",
  "sevkiyat_konteyner_tipleri",
  "sevkiyat_arac_tipleri",
  "sevkiyat_maliyet_ayarlari",
  "sevkiyat_firma_tipleri",
  "sevkiyat_durum_ayarlari",
  "sevkiyat_kur_ayarlari",
] as const;

/**
 * Get shipment settings — cached with unstable_cache (1 hour).
 * Uses admin client (service_role) since unstable_cache runs outside request context.
 * Invalidate by calling revalidateTag("shipment-settings") in server actions.
 */
export const getShipmentSettings: () => Promise<ShipmentSettings> = unstable_cache(
  async (): Promise<ShipmentSettings> => {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...SEVKIYAT_SETTINGS_KEYS]);

    const map = new Map<string, unknown>();
    for (const row of data ?? []) {
      map.set(row.key, row.value);
    }

    // Parse ülkeler
    let ulkeler = FALLBACK_ULKELER;
    const rawUlkeler = map.get("sevkiyat_ulkeler");
    if (Array.isArray(rawUlkeler) && rawUlkeler.length > 0) {
      ulkeler = rawUlkeler as ShipmentCountry[];
    }

    // Parse palet ayarları
    let paletAyarlari = FALLBACK_PALET_AYARLARI;
    const rawPalet = map.get("sevkiyat_palet_ayarlari");
    if (rawPalet && typeof rawPalet === "object" && "boyutlar" in rawPalet) {
      paletAyarlari = rawPalet as PaletAyarlari;
    }

    // Parse konteyner tipleri
    let konteynerTipleri = FALLBACK_KONTEYNER_TIPLERI;
    const rawKonteyner = map.get("sevkiyat_konteyner_tipleri");
    if (Array.isArray(rawKonteyner) && rawKonteyner.length > 0) {
      konteynerTipleri = rawKonteyner as KonteynerTipi[];
    }

    // Parse araç tipleri
    let aracTipleri = FALLBACK_ARAC_TIPLERI;
    const rawArac = map.get("sevkiyat_arac_tipleri");
    if (Array.isArray(rawArac) && rawArac.length > 0) {
      aracTipleri = rawArac as AracTipi[];
    }

    // Parse maliyet ayarları
    let maliyetAyarlari = FALLBACK_MALIYET_AYARLARI;
    const rawMaliyet = map.get("sevkiyat_maliyet_ayarlari");
    if (rawMaliyet && typeof rawMaliyet === "object" && "fields" in rawMaliyet) {
      maliyetAyarlari = rawMaliyet as MaliyetAyarlari;
    }

    // Parse firma tipleri
    let firmaTipleri = FALLBACK_FIRMA_TIPLERI;
    const rawFirma = map.get("sevkiyat_firma_tipleri");
    if (Array.isArray(rawFirma) && rawFirma.length > 0) {
      firmaTipleri = rawFirma as FirmaTipi[];
    }

    // Parse durum etiketleri
    let durumEtiketleri = FALLBACK_DURUM_ETIKETLERI;
    const rawDurum = map.get("sevkiyat_durum_ayarlari");
    if (Array.isArray(rawDurum) && rawDurum.length > 0) {
      durumEtiketleri = rawDurum as DurumEtiketi[];
    }

    // Parse kur ayarları
    let kurAyarlari = FALLBACK_KUR_AYARLARI;
    const rawKur = map.get("sevkiyat_kur_ayarlari");
    if (rawKur && typeof rawKur === "object" && "currencies" in rawKur) {
      kurAyarlari = rawKur as KurAyarlari;
    }

    return {
      ulkeler,
      paletAyarlari,
      konteynerTipleri,
      aracTipleri,
      maliyetAyarlari,
      firmaTipleri,
      durumEtiketleri,
      kurAyarlari,
    };
  } catch {
    // DB hatası durumunda tüm fallback değerler
    return {
      ulkeler: FALLBACK_ULKELER,
      paletAyarlari: FALLBACK_PALET_AYARLARI,
      konteynerTipleri: FALLBACK_KONTEYNER_TIPLERI,
      aracTipleri: FALLBACK_ARAC_TIPLERI,
      maliyetAyarlari: FALLBACK_MALIYET_AYARLARI,
      firmaTipleri: FALLBACK_FIRMA_TIPLERI,
      durumEtiketleri: FALLBACK_DURUM_ETIKETLERI,
      kurAyarlari: FALLBACK_KUR_AYARLARI,
    };
  }
  },
  ["shipment-settings"],
  { revalidate: 3600, tags: ["shipment-settings"] }
);
