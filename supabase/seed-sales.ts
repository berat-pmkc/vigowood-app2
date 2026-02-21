/**
 * Seed script: VIGO WOOD SATISLAR.xlsx → satis_raporlari, satis_satirlari, tr_pazarlama, kampanyalar
 *
 * Kullanım:
 *   npx tsx supabase/seed-sales.ts
 *
 * NOT: Stok düşümü YAPILMAZ — geçmiş veriler zaten stock_movements'ta kayıtlı.
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EXCEL_PATH = path.resolve(__dirname, "../../data/VIGO WOOD SATISLAR.xlsx");

// ─── Helpers ──────────────────────────────────────────────

function excelDateToISO(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString().split("T")[0];
}

function excelDateToTimestamp(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString();
}

function parseNumber(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim().replace(/[^\d.,-]/g, "");
  if (!str) return 0;
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    return parseFloat(str.replace(/,/g, "")) || 0;
  }
  if (str.includes(",")) return parseFloat(str.replace(",", ".")) || 0;
  return parseFloat(str) || 0;
}

const SERVICE_SKUS = [
  "KARGO", "HIZMET", "YEDEK PARCA", "TS-M", "FIYAT FARKI",
  "DIS KUTU", "KOLI", "KUTU", "MONTAJ", "AMBALAJ",
];

function isServiceSku(sku: string): boolean {
  if (!sku) return false;
  const upper = sku.toUpperCase().trim();
  return SERVICE_SKUS.some((s) => upper === s || upper.startsWith(s + " "));
}

function isExportChannel(channel: string): boolean {
  return channel.startsWith("HAS-");
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log("Reading Excel:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  // ───────────────── 1. SatısBatches → satis_raporlari ─────────────────

  console.log("\n=== Step 1: SatısBatches → satis_raporlari ===");

  const batchesRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["SatısBatches"]);
  const batchMap = new Map<string, { createdAt: string; user: string | null }>();

  for (const row of batchesRaw) {
    const batchId = String(row["BatchID"] || "").trim();
    if (!batchId) continue;

    const createdAtRaw = row["CreatedAt"];
    const createdAt = typeof createdAtRaw === "number"
      ? excelDateToTimestamp(createdAtRaw)
      : new Date().toISOString();

    const user = row["User"] ? String(row["User"]).trim() : null;
    batchMap.set(batchId, { createdAt, user });
  }

  console.log(`  Found ${batchMap.size} batches`);

  // ───────────────── 2. SATISLAR → aggregate per batch ─────────────────

  console.log("\n=== Step 2: SATISLAR → satis_satirlari ===");

  const satisRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["SATISLAR"]);
  console.log(`  Found ${satisRaw.length} rows`);

  // Group rows by BatchID
  const rowsByBatch = new Map<string, Array<{
    tarih: string | null;
    satis_kanali: string | null;
    fatura_no: string | null;
    musteri_adi: string | null;
    sku: string | null;
    miktar: number;
    birim_fiyat: number;
    toplam_tutar: number;
    kdv_orani: number | null;
    doviz: string;
    is_hizmet: boolean;
  }>>();

  let skippedRows = 0;

  for (const row of satisRaw) {
    const batchId = row["BatchID"] ? String(row["BatchID"]).trim() : "LEGACY";
    const sku = row["Stok-Hizmet Kodu"] ? String(row["Stok-Hizmet Kodu"]).trim() : null;
    const miktar = parseNumber(row["Miktar"]);

    if (!sku || miktar === 0) {
      skippedRows++;
      continue;
    }

    const tarihRaw = row["Tarih"];
    const tarih = typeof tarihRaw === "number" ? excelDateToISO(tarihRaw) : null;

    const satisElemani = row["Satış Elemanı"] ? String(row["Satış Elemanı"]).trim().toUpperCase() : null;
    const faturaNo = row["Fatura No"] ? String(row["Fatura No"]).trim() : null;
    const musteri = row["Ünvan"] ? String(row["Ünvan"]).trim() : null;
    const birimFiyat = parseNumber(row["Birim Fiyat"]);
    const toplamTutar = parseNumber(row["Toplam Tutar"]);
    const kdvRaw = row["KDV %"];
    const kdvOrani = kdvRaw != null && kdvRaw !== "" ? parseNumber(kdvRaw) : null;
    const dovizRaw = row["Satır Dövizi"];
    const doviz = dovizRaw ? String(dovizRaw).trim() : "TL";

    const parsed = {
      tarih,
      satis_kanali: satisElemani,
      fatura_no: faturaNo,
      musteri_adi: musteri,
      sku,
      miktar: Math.round(miktar),
      birim_fiyat: birimFiyat,
      toplam_tutar: toplamTutar,
      kdv_orani: kdvOrani,
      doviz,
      is_hizmet: isServiceSku(sku),
    };

    const existing = rowsByBatch.get(batchId) || [];
    existing.push(parsed);
    rowsByBatch.set(batchId, existing);
  }

  console.log(`  Parsed rows by batch: ${rowsByBatch.size} batches, ${skippedRows} skipped`);

  // ───────────────── 3. Check existing data ─────────────────

  console.log("\n=== Step 3: Check existing data ===");

  const { count: existingRaporCount } = await supabase
    .from("satis_raporlari")
    .select("*", { count: "exact", head: true });

  if (existingRaporCount && existingRaporCount > 0) {
    console.log(`  WARNING: ${existingRaporCount} existing raporlar found.`);
    console.log("  Deleting existing data first...");

    // Delete in order: satirlar (FK cascade), then raporlar
    await supabase.from("satis_raporlari").delete().neq("rapor_id", "___impossible___");
    console.log("  Cleared satis_raporlari (cascades to satis_satirlari)");
  }

  const { count: existingPazCount } = await supabase
    .from("tr_pazarlama")
    .select("*", { count: "exact", head: true });
  if (existingPazCount && existingPazCount > 0) {
    await supabase.from("tr_pazarlama").delete().neq("kodu", "___impossible___");
    console.log(`  Cleared ${existingPazCount} existing tr_pazarlama rows`);
  }

  const { count: existingKampCount } = await supabase
    .from("kampanyalar")
    .select("*", { count: "exact", head: true });
  if (existingKampCount && existingKampCount > 0) {
    await supabase.from("kampanyalar").delete().neq("kodu", "___impossible___");
    console.log(`  Cleared ${existingKampCount} existing kampanyalar rows`);
  }

  // ───────────────── 4. Insert satis_raporlari ─────────────────

  console.log("\n=== Step 4: Insert satis_raporlari ===");

  let raporInserted = 0;

  for (const [batchId, rows] of rowsByBatch) {
    const batchInfo = batchMap.get(batchId);

    // Build rapor_id: SAT-<batchId>
    const raporId = `SAT-${batchId}`;

    // Compute rapor_tarihi from first row's date
    const raporTarihi = rows[0]?.tarih || "2025-01-01";

    // Compute totals
    const toplamSatir = rows.length;
    const toplamAdet = rows.filter((r) => !r.is_hizmet).reduce((s, r) => s + r.miktar, 0);
    const toplamTutar = rows.reduce((s, r) => s + r.toplam_tutar, 0);
    const trTutar = rows
      .filter((r) => !r.satis_kanali || !isExportChannel(r.satis_kanali))
      .reduce((s, r) => s + r.toplam_tutar, 0);
    const ihracatTutar = rows
      .filter((r) => r.satis_kanali && isExportChannel(r.satis_kanali))
      .reduce((s, r) => s + r.toplam_tutar, 0);

    const { error } = await supabase.from("satis_raporlari").insert({
      rapor_id: raporId,
      rapor_tarihi: raporTarihi,
      yukleme_tarihi: batchInfo?.createdAt || new Date().toISOString(),
      yukleyen_adi: batchInfo?.user || "Geçmiş Veri",
      dosya_adi: `legacy-${batchId}`,
      toplam_satir: toplamSatir,
      toplam_adet: toplamAdet,
      toplam_tutar: toplamTutar,
      tr_tutar: trTutar,
      ihracat_tutar: ihracatTutar,
      durum: "aktif",
    });

    if (error) {
      console.error(`  ERROR inserting rapor ${raporId}:`, error.message);
    } else {
      raporInserted++;
    }
  }

  console.log(`  Inserted ${raporInserted} raporlar`);

  // ───────────────── 5. Insert satis_satirlari (batch 500) ─────────────────

  console.log("\n=== Step 5: Insert satis_satirlari ===");

  let satirInserted = 0;
  let satirErrors = 0;

  for (const [batchId, rows] of rowsByBatch) {
    const raporId = `SAT-${batchId}`;

    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500).map((r) => ({
        rapor_id: raporId,
        tarih: r.tarih,
        satis_kanali: r.satis_kanali,
        fatura_no: r.fatura_no,
        musteri_adi: r.musteri_adi,
        sku: r.sku,
        miktar: r.miktar,
        birim_fiyat: r.birim_fiyat,
        toplam_tutar: r.toplam_tutar,
        kdv_orani: r.kdv_orani,
        doviz: r.doviz,
        is_hizmet: r.is_hizmet,
      }));

      const { error } = await supabase.from("satis_satirlari").insert(batch);
      if (error) {
        console.error(`  ERROR inserting satirlar for ${raporId} (batch ${i}):`, error.message);
        satirErrors++;
      } else {
        satirInserted += batch.length;
      }
    }
  }

  console.log(`  Inserted ${satirInserted} satirlar (${satirErrors} batch errors)`);

  // ───────────────── 6. TR Pazarlama ─────────────────

  console.log("\n=== Step 6: TR Pazarlama ===");

  const trpRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["TR Pazarlama"]);
  const trpRows = trpRaw.filter((r) => r["Kodu"]);

  let pazInserted = 0;

  for (const r of trpRows) {
    const { error } = await supabase.from("tr_pazarlama").insert({
      kodu: String(r["Kodu"]).trim(),
      yil: Number(r["Yıl"]) || 2025,
      ay: Number(r["Ay"]) || 1,
      pazaryeri: String(r["Pazaryeri"] || "").trim(),
      hedef_ciro: parseNumber(r["Hedef Ciro (TL)"]),
      gercek_ciro: parseNumber(r["Gerçek Ciro (TL)"]),
      siparis_sayisi: Math.round(parseNumber(r["Sipariş Sayısı"])),
      ziyaretci: Math.round(parseNumber(r["Ziyaretçi (Oturum)"])),
      donusum_orani: parseNumber(r["Dönüşüm Oranı (CR)"]),
      iadeler: Math.round(parseNumber(r["İadeler"])),
      ortalama_sepet: r["Ortalama Sepet (TL)"] != null ? parseNumber(r["Ortalama Sepet (TL)"]) : null,
      reklam_harcamasi: r["Reklam Harcaması (TL)"] != null ? parseNumber(r["Reklam Harcaması (TL)"]) : null,
      not_text: r["Not"] ? String(r["Not"]).trim() : null,
    });

    if (error) {
      console.error(`  ERROR inserting TR Pazarlama ${r["Kodu"]}:`, error.message);
    } else {
      pazInserted++;
    }
  }

  console.log(`  Inserted ${pazInserted}/${trpRows.length} TR Pazarlama rows`);

  // ───────────────── 7. Kampanyalar ─────────────────

  console.log("\n=== Step 7: Kampanyalar ===");

  const kampRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Kampanyalar"]);
  const kampRows = kampRaw.filter((r) => r["Kodu"]);

  let kampInserted = 0;

  for (const r of kampRows) {
    const baslangicRaw = r["Başlangıç Tarihi"];
    const bitisRaw = r["Bitiş Tarihi"];

    const baslangic = typeof baslangicRaw === "number"
      ? excelDateToISO(baslangicRaw)
      : String(baslangicRaw || "2025-01-01");

    const bitis = typeof bitisRaw === "number"
      ? excelDateToISO(bitisRaw)
      : String(bitisRaw || "2025-01-31");

    const { error } = await supabase.from("kampanyalar").insert({
      kodu: String(r["Kodu"]).trim(),
      kampanya_adi: String(r["Kampanya Adı"] || "").trim(),
      baslangic_tarihi: baslangic,
      bitis_tarihi: bitis,
      ana_hedef: r["Ana Hedef"] ? String(r["Ana Hedef"]).trim() : null,
      ziyaretci: r["Ziyaretçi"] != null ? Math.round(parseNumber(r["Ziyaretçi"])) : null,
      siparis_sayisi: r["Sipariş Sayısı"] != null ? Math.round(parseNumber(r["Sipariş Sayısı"])) : null,
      ciro: r["Ciro (TL)"] != null ? parseNumber(r["Ciro (TL)"]) : null,
      donusum_orani: r["Dönüşüm Oranı"] != null ? parseNumber(r["Dönüşüm Oranı"]) : null,
      ortalama_sepet: r["Ortalama Sepet (TL)"] != null ? parseNumber(r["Ortalama Sepet (TL)"]) : null,
      notlar: r["Not / Öğrenilenler"] ? String(r["Not / Öğrenilenler"]).trim() : null,
      aktif_mi: true,
    });

    if (error) {
      console.error(`  ERROR inserting Kampanya ${r["Kodu"]}:`, error.message);
    } else {
      kampInserted++;
    }
  }

  console.log(`  Inserted ${kampInserted}/${kampRows.length} Kampanyalar rows`);

  // ───────────────── Summary ─────────────────

  console.log("\n=== SEED COMPLETE ===");
  console.log(`  satis_raporlari: ${raporInserted}`);
  console.log(`  satis_satirlari: ${satirInserted}`);
  console.log(`  tr_pazarlama: ${pazInserted}`);
  console.log(`  kampanyalar: ${kampInserted}`);
  console.log("\nNOT: Stok düşümü yapılmadı — geçmiş veriler zaten stock_movements'ta.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
