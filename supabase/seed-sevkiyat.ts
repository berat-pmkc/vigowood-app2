/**
 * VigoWood — Seed: Sevkiyat Fiyatlar + Tarihsel Sevkiyat (Katman 18A)
 *
 * Imports:
 *  - sevkiyat_fiyatlar (150 kayıt) from PROFORMA FATURALAR → FİYATLAR sheet
 *  - sevkiyat (11 kayıt) from Sevkiyat Planları → Sevkiyat Listesi
 *  - sevkiyat_items (~120 kayıt) from Sevkiyat Planları → individual sheets (DE17, DE18, etc.)
 *
 * Usage:
 *   npx tsx supabase/seed-sevkiyat.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import XLSX from "xlsx";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Run from project root: npx tsx supabase/seed-sevkiyat.ts");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function excelDateToISO(serial: number | undefined): string | null {
  if (!serial || typeof serial !== "number") return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 86400000);
  return date.toISOString().split("T")[0];
}

// ─── Parse country code from sevkiyat_id ─────────────────────

function parseCountryCode(sevkiyatId: string): string | null {
  if (sevkiyatId.startsWith("DE")) return "DE";
  if (sevkiyatId.startsWith("UK")) return "UK";
  if (sevkiyatId.startsWith("USA")) return "USA";
  return null;
}

function parseShipmentNumber(sevkiyatId: string): number | null {
  const match = sevkiyatId.match(/\d+$/);
  return match ? parseInt(match[0], 10) : null;
}

const COUNTRY_MAP: Record<string, { name: string; nameEN: string; port: string; buyer: string }> = {
  DE: { name: "Almanya", nameEN: "Germany", port: "Muratbey", buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI." },
  UK: { name: "İngiltere", nameEN: "United Kingdom", port: "Gemlik", buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI." },
  USA: { name: "Amerika", nameEN: "United States", port: "Gemlik", buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI." },
};

// ─── 1. Fiyat Seed ───────────────────────────────────────────

async function seedFiyatlar() {
  console.log("\n💰 Sevkiyat fiyatları seed başlatılıyor...");

  const wb = XLSX.readFile(resolve(process.cwd(), "..", "data", "VIGO WOOD PROFORMA FATURALAR.xlsx"));
  const ws = wb.Sheets["FİYATLAR"];
  if (!ws) {
    console.error("FİYATLAR sheet bulunamadı!");
    return;
  }

  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
  console.log(`  ${rows.length} fiyat satırı bulundu`);

  const records = rows.map((row) => ({
    country_code: String(row["Ülke"] ?? ""),
    sku: String(row["Ürün Kodu"] ?? ""),
    urun_adi_en: row["Ürün Adı"] ? String(row["Ürün Adı"]) : null,
    gtip: row["GTIP"] ? String(row["GTIP"]) : null,
    birim_fiyat: Number(row["Birim Fiyat"] ?? 0),
    kategori: row["KATEGORİ"] ? String(row["KATEGORİ"]) : null,
    package_qty: row["PackageQty"] ? Number(row["PackageQty"]) : null,
    asin: row["ASIN"] ? String(row["ASIN"]) : null,
  })).filter((r) => r.country_code && r.sku);

  // Batch upsert
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("sevkiyat_fiyatlar").upsert(batch, {
      onConflict: "country_code,sku",
    });
    if (error) {
      console.error(`  Batch ${i / batchSize + 1} hata:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted} fiyat kaydı eklendi/güncellendi`);
}

// ─── 2. Sevkiyat + Items Seed ─────────────────────────────────

async function seedSevkiyatlar() {
  console.log("\n🚚 Tarihsel sevkiyat seed başlatılıyor...");

  const wb = XLSX.readFile(resolve(process.cwd(), "..", "data", "VIGO WOOD Sevkiyat Planları.xlsx"));
  const listeWs = wb.Sheets["Sevkiyat Listesi"];
  if (!listeWs) {
    console.error("Sevkiyat Listesi sheet bulunamadı!");
    return;
  }

  const listeRows = XLSX.utils.sheet_to_json(listeWs) as Record<string, unknown>[];
  console.log(`  ${listeRows.length} sevkiyat kaydı bulundu`);

  // Durum mapping
  const durumMap: Record<string, string> = {
    "Sevk Edildi": "teslim_edildi",
    "Hazırlanıyor": "hazirlaniyor",
    "Bekliyor": "bekliyor",
  };

  let sevkInserted = 0;
  let itemsInserted = 0;

  for (const row of listeRows) {
    const sevkiyatId = String(row["Sevkiyat Kodu"] ?? "");
    if (!sevkiyatId) continue;

    const countryCode = parseCountryCode(sevkiyatId);
    const shipmentNumber = parseShipmentNumber(sevkiyatId);
    const country = countryCode ? COUNTRY_MAP[countryCode] : null;
    const durumExcel = String(row["Durum"] ?? "");
    const durum = durumMap[durumExcel] ?? "teslim_edildi";

    const sevkTarihi = excelDateToISO(row["Planlanan Sevk Tarihi"] as number);

    // Upsert sevkiyat
    const { error: sevkError } = await supabase.from("sevkiyat").upsert({
      sevkiyat_id: sevkiyatId,
      musteri: country?.buyer ?? "HAS-MOB",
      ulke: country?.nameEN ?? null,
      country_code: countryCode,
      shipment_number: shipmentNumber,
      sevkiyat_adi: String(row["Sevkiyat Adı"] ?? ""),
      liman: country?.port ?? null,
      teslimat_tipi: "DAP",
      sevk_tarihi: sevkTarihi,
      durum,
      konteyner_no: null,
      konteyner_tipi: null,
      not_text: null,
      operator_id: null,
      operator_name: null,
      email: null,
    }, { onConflict: "sevkiyat_id" });

    if (sevkError) {
      console.error(`  Sevkiyat ${sevkiyatId} hata:`, sevkError.message);
      continue;
    }
    sevkInserted++;

    // Detay sheet'ini oku
    const detailSheet = wb.Sheets[sevkiyatId];
    if (!detailSheet) {
      console.log(`  ⚠ ${sevkiyatId} detay sheet'i yok, atlanıyor`);
      continue;
    }

    const detailRows = XLSX.utils.sheet_to_json(detailSheet) as Record<string, unknown>[];

    // Mevcut items'ı temizle
    await supabase.from("sevkiyat_items").delete().eq("sevkiyat_id", sevkiyatId);

    for (let idx = 0; idx < detailRows.length; idx++) {
      const dRow = detailRows[idx];
      const sku = String(dRow["KODU"] ?? dRow["ÜRÜN"] ?? "");
      if (!sku) continue;

      const paletBoyut = String(dRow["PALET"] ?? "80x120");
      const paletYukseklik = Number(dRow["Palet Yükseklik\n CM"] ?? dRow["Palet Yükseklik CM"] ?? 0);
      const en = Number(dRow["EN"] ?? 0);
      const boy = Number(dRow["BOY"] ?? 0);
      const yuk = Number(dRow["YÜKS"] ?? 0);
      const koliAdedi = Number(dRow["ADET"] ?? 1);
      const paletteKoli = Number(dRow["PALETTE KOLİ"] ?? 1);
      const toplamKoli = Number(dRow["TOPLAM KOLİ"] ?? 0);
      const hacim = Number(dRow["HACİM (m3)"] ?? 0);
      const desi = Number(dRow["DESİ"] ?? 0);
      const koliAgirlik = Number(dRow["KOLİ AĞIRLIK"] ?? 0);
      const agirlik = Number(dRow["AĞIRLIK (kg)"] ?? 0);
      const grup = dRow["GRUP"] ? String(dRow["GRUP"]).trim() : null;
      const paletSayisi = Number(dRow["PALET_1"] ?? 0);
      const qty = Number(dRow["Adet"] ?? toplamKoli * koliAdedi);

      // Fiyat bilgisini çek
      let birimFiyat = 0;
      if (countryCode) {
        const { data: fiyatData } = await supabase
          .from("sevkiyat_fiyatlar")
          .select("birim_fiyat")
          .eq("country_code", countryCode)
          .eq("sku", sku)
          .single();
        if (fiyatData) birimFiyat = (fiyatData as { birim_fiyat: number }).birim_fiyat;
      }

      const itemId = `SVI-${sevkiyatId}-${String(idx + 1).padStart(3, "0")}`;

      const { error: itemError } = await supabase.from("sevkiyat_items").insert({
        item_id: itemId,
        sevkiyat_id: sevkiyatId,
        sku,
        urun_adi: String(dRow["ÜRÜN"] ?? sku),
        qty,
        palet_boyut: paletBoyut,
        palet_yukseklik: paletYukseklik || null,
        en: en || null,
        boy: boy || null,
        yuk: yuk || null,
        koli_adedi: koliAdedi || null,
        palette_koli: paletteKoli || null,
        toplam_koli: toplamKoli || null,
        hacim: hacim || null,
        desi: desi || null,
        koli_agirlik: koliAgirlik || null,
        agirlik: agirlik || null,
        grup,
        palet_sayisi: paletSayisi || null,
        birim_fiyat: birimFiyat || null,
        toplam_fiyat: birimFiyat ? Math.round(qty * birimFiyat * 100) / 100 : null,
      });

      if (itemError) {
        console.error(`  Item ${itemId} hata:`, itemError.message);
      } else {
        itemsInserted++;
      }
    }
  }

  console.log(`  ✅ ${sevkInserted} sevkiyat + ${itemsInserted} kalem eklendi`);
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Sevkiyat seed başlatılıyor...\n");

  await seedFiyatlar();
  await seedSevkiyatlar();

  console.log("\n✅ Seed tamamlandı!");
}

main().catch((err) => {
  console.error("Seed hatası:", err);
  process.exit(1);
});
