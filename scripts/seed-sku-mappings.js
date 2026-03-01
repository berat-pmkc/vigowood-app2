/**
 * SKU eşleştirme verilerini Excel'den Supabase'e yükler.
 *
 * Kaynak: data/trendyol_ikas_eslestirme_tablosu.xlsx → "Eşleşen Ürünler" sheet
 *
 * Kullanım: node scripts/seed-sku-mappings.js
 */
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = "../data/trendyol_ikas_eslestirme_tablosu.xlsx";

async function main() {
  console.log("Excel okunuyor...");
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["Eşleşen Ürünler"];
  if (!ws) {
    console.error("'Eşleşen Ürünler' sheet'i bulunamadı!");
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // İlk satır header, atla
  const dataRows = rows.slice(1).filter((r) => r[0]);

  console.log(`Toplam Excel satırı: ${dataRows.length}`);

  const matched = [];
  const unmatched = [];

  for (const row of dataRows) {
    const durum = String(row[0] || "").trim();
    const isMatched = durum.includes("Eşleşti") && !durum.includes("Eşleşmedi");

    if (isMatched) {
      matched.push(row);
    } else {
      unmatched.push(row);
    }
  }

  console.log(`Eşleşen: ${matched.length}, Eşleşmeyen: ${unmatched.length}`);

  // --- Eşleşen satırlar → 2 kayıt (Trendyol + İkas) ---
  const trendyolRecords = [];
  const ikasRecords = [];

  for (const row of matched) {
    const matchMethod = String(row[1] || "");
    const tyId = row[2] != null ? String(row[2]) : null;
    const tyBarcode = row[3] != null ? String(row[3]).trim() : null;
    const tySku = row[4] != null ? String(row[4]).trim() : null;
    const tyProductCode = row[5] != null ? String(row[5]).trim() : null;
    const tyProductName = row[6] != null ? String(row[6]).trim() : null;
    const ikasId = row[7] != null ? String(row[7]).trim() : null;
    const ikasSku = row[8] != null ? String(row[8]).trim() : null;
    const ikasProductCode = row[9] != null ? String(row[9]).trim() : null;
    const ikasProductName = row[10] != null ? String(row[10]).trim() : null;

    const masterSku = ikasSku || tySku;

    trendyolRecords.push({
      master_sku: masterSku,
      channel: "trendyol",
      channel_sku: tySku,
      channel_barcode: tyBarcode,
      channel_product_code: tyProductCode,
      channel_product_name: tyProductName,
      channel_product_id: tyId,
      match_method: matchMethod,
      match_status: "matched",
      is_active: true,
    });

    ikasRecords.push({
      master_sku: masterSku,
      channel: "ikas",
      channel_sku: ikasSku,
      channel_barcode: null,
      channel_product_code: ikasProductCode,
      channel_product_name: ikasProductName,
      channel_product_id: ikasId,
      match_method: matchMethod,
      match_status: "matched",
      is_active: true,
    });
  }

  // --- Eşleşmeyen satırlar → 1 kayıt (Trendyol only) ---
  const unmatchedRecords = [];

  for (const row of unmatched) {
    const tyId = row[2] != null ? String(row[2]) : null;
    const tyBarcode = row[3] != null ? String(row[3]).trim() : null;
    const tySku = row[4] != null ? String(row[4]).trim() : null;
    const tyProductCode = row[5] != null ? String(row[5]).trim() : null;
    const tyProductName = row[6] != null ? String(row[6]).trim() : null;

    unmatchedRecords.push({
      master_sku: tySku || tyBarcode,
      channel: "trendyol",
      channel_sku: tySku,
      channel_barcode: tyBarcode,
      channel_product_code: tyProductCode,
      channel_product_name: tyProductName,
      channel_product_id: tyId,
      match_method: "eslesmedi",
      match_status: "unmatched",
      is_active: true,
    });
  }

  // --- Upsert ---
  let insertCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  // 1) Trendyol kayıtları: channel + channel_barcode ile kontrol
  console.log("\nTrendyol kayıtları işleniyor...");
  const allTrendyol = [...trendyolRecords, ...unmatchedRecords];

  for (const rec of allTrendyol) {
    if (rec.channel_barcode) {
      // Barkodla varsa güncelle
      const { data: existing } = await supabase
        .from("sku_mappings")
        .select("id")
        .eq("channel", "trendyol")
        .eq("channel_barcode", rec.channel_barcode)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sku_mappings")
          .update(rec)
          .eq("id", existing.id);
        if (error) {
          console.error(`HATA (update TY ${rec.channel_barcode}):`, error.message);
          errorCount++;
        } else {
          updateCount++;
        }
      } else {
        const { error } = await supabase.from("sku_mappings").insert(rec);
        if (error) {
          console.error(`HATA (insert TY ${rec.channel_barcode}):`, error.message);
          errorCount++;
        } else {
          insertCount++;
        }
      }
    } else {
      // Barkod yoksa direkt insert
      const { error } = await supabase.from("sku_mappings").insert(rec);
      if (error) {
        console.error(`HATA (insert TY no-barcode):`, error.message);
        errorCount++;
      } else {
        insertCount++;
      }
    }
  }

  // 2) İkas kayıtları: channel + channel_sku + channel_product_id ile kontrol
  console.log("İkas kayıtları işleniyor...");

  for (const rec of ikasRecords) {
    let query = supabase
      .from("sku_mappings")
      .select("id")
      .eq("channel", "ikas");

    if (rec.channel_sku) query = query.eq("channel_sku", rec.channel_sku);
    if (rec.channel_product_id) query = query.eq("channel_product_id", rec.channel_product_id);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("sku_mappings")
        .update(rec)
        .eq("id", existing.id);
      if (error) {
        console.error(`HATA (update İkas ${rec.channel_sku}):`, error.message);
        errorCount++;
      } else {
        updateCount++;
      }
    } else {
      const { error } = await supabase.from("sku_mappings").insert(rec);
      if (error) {
        console.error(`HATA (insert İkas ${rec.channel_sku}):`, error.message);
        errorCount++;
      } else {
        insertCount++;
      }
    }
  }

  // --- Özet ---
  console.log("\n=== ÖZET ===");
  console.log(`Toplam Excel satırı: ${dataRows.length}`);
  console.log(`  Eşleşen: ${matched.length} (→ ${matched.length * 2} kayıt: TY + İkas)`);
  console.log(`  Eşleşmeyen: ${unmatched.length} (→ ${unmatched.length} kayıt: sadece TY)`);
  console.log(`Beklenen toplam: ${matched.length * 2 + unmatched.length}`);
  console.log(`  Insert: ${insertCount}`);
  console.log(`  Güncelleme: ${updateCount}`);
  console.log(`  Hata: ${errorCount}`);

  // Doğrulama
  const { count } = await supabase
    .from("sku_mappings")
    .select("*", { count: "exact", head: true });
  console.log(`\nVeritabanı toplam kayıt: ${count}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
