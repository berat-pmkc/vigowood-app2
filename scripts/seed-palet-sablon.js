/**
 * Excel sevkiyat planlarından palet/koli şablonlarını Supabase'e upsert eder.
 *
 * Kullanım: node scripts/seed-palet-sablon.js
 */
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = "../data/VIGO WOOD Sevkiyat Planları.xlsx";

// Sheet → country_code mapping (sıra önemli: son sheet ezer)
const SHEET_COUNTRY_MAP = {
  DE17: "DE", DE18: "DE", DE19: "DE", DE20: "DE",
  UK26: "UK", UK27: "UK", UK28: "UK",
  USA21: "USA", USA22: "USA", USA23: "USA", USA24: "USA",
};

async function main() {
  console.log("Excel okunuyor...");
  const wb = XLSX.readFile(EXCEL_PATH);

  // Products tablosundan urun_adi'ları çek
  const { data: products } = await supabase.from("products").select("sku, urun_adi");
  const productNames = new Map();
  if (products) {
    for (const p of products) {
      productNames.set(p.sku, p.urun_adi);
    }
  }
  console.log(`Products tablosundan ${productNames.size} ürün adı yüklendi.`);

  // Tüm sheet'lerden şablon verisi topla
  const templates = new Map();
  let totalRows = 0;

  for (const [sheetName, cc] of Object.entries(SHEET_COUNTRY_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.log(`  Sheet ${sheetName} bulunamadı, atlanıyor.`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(ws);
    let sheetCount = 0;

    for (const row of rows) {
      const sku = (row["KODU"] || "").toString().trim();
      if (!sku) continue;

      const koliAdedi = Number(row["ADET"]) || 0;
      const paletteKoli = Number(row["PALETTE KOLİ"] || row["PALETTE_KOLİ"]) || 0;
      const koliAgirlik = Number(row["KOLİ AĞIRLIK"] || row["KOLI_AGIRLIK"]) || 0;

      // Zorunlu alanlar eksikse atla
      if (!koliAdedi || !paletteKoli || !koliAgirlik) continue;

      // Palet yükseklik — farklı kolon isimleri dene
      let paletYukseklik = 0;
      for (const colName of Object.keys(row)) {
        if (colName.toLowerCase().includes("palet") && colName.toLowerCase().includes("yükseklik")) {
          paletYukseklik = Number(row[colName]) || 0;
          break;
        }
      }
      if (!paletYukseklik) paletYukseklik = 125;

      const key = cc + ":" + sku;
      totalRows++;
      sheetCount++;

      // Ürün adı: önce products tablosu, yoksa Excel, yoksa SKU
      const urunAdi = productNames.get(sku) || (row["ÜRÜN"] || "").toString().trim() || sku;

      templates.set(key, {
        country_code: cc,
        sku,
        urun_adi: urunAdi,
        palet_boyut: (row["PALET"] || (cc === "DE" ? "80x120" : "100x120")).toString().trim(),
        palet_yukseklik: paletYukseklik,
        en: Number(row["EN"]) || 0,
        boy: Number(row["BOY"]) || 0,
        yuk: Number(row["YÜKS"]) || 0,
        koli_adedi: koliAdedi,
        palette_koli: paletteKoli,
        koli_agirlik: koliAgirlik,
      });
    }

    console.log(`  ${sheetName} (${cc}): ${sheetCount} satır okundu`);
  }

  console.log(`\nToplam satır: ${totalRows}, Unique şablon: ${templates.size}`);

  // Ülke bazında dağılım
  const byCountry = {};
  for (const [, t] of templates) {
    byCountry[t.country_code] = (byCountry[t.country_code] || 0) + 1;
  }
  console.log("Ülke dağılımı:", JSON.stringify(byCountry));

  // en/boy/yuk 0 kontrolü
  const invalid = [];
  for (const [key, t] of templates) {
    if (!t.en || !t.boy || !t.yuk) {
      invalid.push(key);
    }
  }
  if (invalid.length > 0) {
    console.log(`\n⚠ En/boy/yuk sıfır: ${invalid.join(", ")}`);
  }

  // Batch upsert (50'şer)
  const allTemplates = [...templates.values()];
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < allTemplates.length; i += BATCH_SIZE) {
    const batch = allTemplates.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("sevkiyat_palet_sablon")
      .upsert(batch, { onConflict: "country_code,sku" });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} hatası:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`  Upserted: ${inserted}/${allTemplates.length}\r`);
    }
  }

  console.log(`\n\n✅ Tamamlandı: ${inserted} şablon upsert edildi, ${errors} hata.`);

  // Mevcut DB'deki toplam sayıyı kontrol et
  const { count } = await supabase
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact", head: true });

  console.log(`DB'deki toplam şablon sayısı: ${count}`);
}

main().catch(console.error);
