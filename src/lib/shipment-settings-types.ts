// Types and pure helper functions for shipment settings.
// Safe to import from both server and client components.

// ─── Types ──────────────────────────────────────────────────────

export interface ShipmentCountry {
  code: string;
  name: string;
  nameEN: string;
  currency: string;
  currencySymbol: string;
  port: string;
  buyer: string;
}

export interface PaletAyarlari {
  boyutlar: string[];
  paletWeightKg: number;
  defaultYukseklik: number;
}

export interface KonteynerTipi {
  type: string;
  label: string;
}

export interface AracTipi {
  id: string;
  label: string;
}

export interface MaliyetField {
  key: string;
  label: string;
  defaultCurrency: string;
}

export interface MaliyetAyarlari {
  paraBirimleri: string[];
  fields: MaliyetField[];
  desiCarpani: number;
}

export interface FirmaTipi {
  id: string;
  label: string;
}

export interface DurumEtiketi {
  id: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  borderL: string;
}

export interface KurAyarlari {
  currencies: string[];
}

export interface ShipmentSettings {
  ulkeler: ShipmentCountry[];
  paletAyarlari: PaletAyarlari;
  konteynerTipleri: KonteynerTipi[];
  aracTipleri: AracTipi[];
  maliyetAyarlari: MaliyetAyarlari;
  firmaTipleri: FirmaTipi[];
  durumEtiketleri: DurumEtiketi[];
  kurAyarlari: KurAyarlari;
}

// ─── Pure Helper Functions ──────────────────────────────────────

/** Ülke kodu ile ülke bilgisini bul */
export function getCountryByCode(code: string, countries: ShipmentCountry[]): ShipmentCountry | undefined {
  return countries.find((c) => c.code === code);
}

/** Ülke kodlarını Record'a çevir (hızlı lookup) */
export function getCountryMap(countries: ShipmentCountry[]): Record<string, ShipmentCountry> {
  const map: Record<string, ShipmentCountry> = {};
  for (const c of countries) {
    map[c.code] = c;
  }
  return map;
}

/** Konteyner tip etiketini bul */
export function getKonteynerLabel(type: string, konteynerler: KonteynerTipi[]): string {
  return konteynerler.find((k) => k.type === type)?.label ?? type;
}

/** Durum etiketini bul */
export function getDurumEtiketi(durumId: string, etiketler: DurumEtiketi[]): DurumEtiketi | undefined {
  return etiketler.find((d) => d.id === durumId);
}

/** Firma tip etiketini bul */
export function getFirmaTipiLabel(id: string, firmaTipleri: FirmaTipi[]): string {
  return firmaTipleri.find((f) => f.id === id)?.label ?? id;
}
