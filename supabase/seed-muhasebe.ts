/**
 * Seed script: Muhasebe ve Finans verileri
 *
 * Kaynak:
 *   - HASMOB HAFTALIK VARLIK VE BORÇ TAKİP TABLOSU.xlsx
 *     → nakit_donemler, nakit_girisler, nakit_cikislar, odemeler, nakit_giris_takip
 *   - FALİYET HESAPLARI.xlsx
 *     → faaliyet_donemler, satis_giris, maliyet_giris, karlilik_data
 *
 * Kullanım:
 *   npx tsx supabase/seed-muhasebe.ts
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

const HASMOB_PATH = path.resolve(__dirname, "../../data/HASMOB HAFTALIK VARLIK VE BORÇ TAKİP TABLOSU.xlsx");
const FAALIYET_PATH = path.resolve(__dirname, "../../data/FALİYET HESAPLARI.xlsx");

// ─── Helpers ──────────────────────────────────────────────

function excelDateToISO(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString().split("T")[0];
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

/** Parse dönem kodu (2026-1-D1) to date range */
function parseDonumKodu(kodu: string): { baslangic: string; bitis: string } {
  // Format: YYYY-M-D# (2026-1-D1, 2026-2-D2)
  const match = kodu.match(/^(\d{4})-(\d{1,2})-D(\d)$/);
  if (!match) return { baslangic: "2026-01-01", bitis: "2026-01-14" };

  const yil = parseInt(match[1]);
  const ay = parseInt(match[2]);
  const donem = parseInt(match[3]);

  if (donem === 1) {
    const baslangic = `${yil}-${String(ay).padStart(2, "0")}-01`;
    const bitis = `${yil}-${String(ay).padStart(2, "0")}-14`;
    return { baslangic, bitis };
  } else {
    const baslangic = `${yil}-${String(ay).padStart(2, "0")}-15`;
    // Last day of month
    const lastDay = new Date(yil, ay, 0).getDate();
    const bitis = `${yil}-${String(ay).padStart(2, "0")}-${lastDay}`;
    return { baslangic, bitis };
  }
}

/** Map CİNSİ values to para_birimi enum */
function mapParaBirimi(val: unknown): "TL" | "USD" | "EUR" | null {
  if (!val) return null;
  const str = String(val).trim().toUpperCase();
  if (str === "TL") return "TL";
  if (str === "USD") return "USD";
  if (str === "EURO" || str === "EUR") return "EUR";
  return null;
}

/** Map TÜRÜ values to odeme_turu enum */
function mapOdemeTuru(val: unknown): string | null {
  if (!val) return null;
  const str = String(val).trim();
  const valid = [
    "PİYASA", "KREDİ", "KREDİ KARTI", "MAAŞ", "FAİZ",
    "SGK", "VERGİ", "HAMMADDE", "PERSONEL", "ELEKTRİK",
    "BANKA", "GENEL", "DİĞER",
  ];
  if (valid.includes(str)) return str;
  return null;
}

/** Map ÖDEME values to odeme_durumu enum */
function mapOdemeDurum(val: unknown): "TAMAMLANDI" | "BEKLİYOR" {
  if (!val) return "BEKLİYOR";
  const str = String(val).trim().toUpperCase();
  if (str === "TAMAMLANDI") return "TAMAMLANDI";
  return "BEKLİYOR";
}

/** Map faaliyet_turu */
function mapFaaliyetTuru(val: unknown): "FAALIYET" | "FAALIYET_DISI" {
  if (!val) return "FAALIYET";
  const str = String(val).trim();
  if (str.includes("DIŞI") || str.includes("DISI")) return "FAALIYET_DISI";
  return "FAALIYET";
}

/** Map maliyet_grubu */
function mapMaliyetGrubu(val: unknown): "VIGO_WOOD" | "HAS_MOB" | "ORTAK" | null {
  if (!val) return null;
  const str = String(val).trim().toUpperCase();
  if (str.includes("ORTAK")) return "ORTAK";
  if (str.includes("HAS")) return "HAS_MOB";
  if (str.includes("VIGO")) return "VIGO_WOOD";
  return null;
}

/** Map kalem_turu */
function mapKalemTuru(val: unknown): string {
  if (!val) return "GELIR";
  const str = String(val).trim().toUpperCase();
  if (str === "GELİR" || str === "GELIR") return "GELIR";
  if (str === "GİDER" || str === "GIDER") return "GIDER";
  if (str === "TOPLAM") return "TOPLAM";
  if (str === "KAR" || str === "KÂR") return "KAR";
  if (str === "MARJ") return "MARJ";
  if (str === "FD_GELİR" || str === "FD_GELIR") return "FD_GELIR";
  if (str === "FD_GİDER" || str === "FD_GIDER") return "FD_GIDER";
  return "GELIR";
}

/** Clear table using service role */
async function clearTable(table: string): Promise<void> {
  const { error } = await supabase.from(table).delete().not("id", "is", null);
  if (error) console.error(`  Warning clearing ${table}:`, error.message);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log("=== Muhasebe & Finans Seed ===\n");

  // ═══════════════════════════════════════════════════════
  // PART A: HASMOB — Nakit Akış
  // ═══════════════════════════════════════════════════════

  console.log("Reading HASMOB xlsx:", HASMOB_PATH);
  const hasmobWb = XLSX.readFile(HASMOB_PATH);

  // Clear child tables first (FK cascade), then parents
  console.log("\nClearing existing muhasebe data...");
  await clearTable("nakit_girisler");
  await clearTable("nakit_cikislar");
  await clearTable("nakit_giris_takip");
  await clearTable("odemeler");
  await clearTable("nakit_donemler");
  await clearTable("karlilik_data");
  await clearTable("maliyet_giris");
  await clearTable("satis_giris");
  await clearTable("faaliyet_donemler");
  console.log("  Done.\n");

  // ─── 1. VERİLER → nakit_donemler ────────────────────────
  console.log("=== Step 1: VERİLER → nakit_donemler ===");
  const verilerSheet = hasmobWb.Sheets["VERİLER"];
  if (!verilerSheet) {
    console.error("VERİLER sheet not found!");
    process.exit(1);
  }
  const verilerRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(verilerSheet);
  console.log(`  Found ${verilerRows.length} rows`);

  // Debug first row keys
  if (verilerRows.length > 0) {
    console.log("  Columns:", Object.keys(verilerRows[0]).join(", "));
  }

  const donemMap = new Map<string, string>(); // donem_kodu → id

  for (const row of verilerRows) {
    const keys = Object.keys(row);
    const donemKodu = String(row[keys[0]] || "").trim();
    if (!donemKodu || !donemKodu.match(/^\d{4}-/)) continue;

    const { baslangic, bitis } = parseDonumKodu(donemKodu);

    const record = {
      donem_kodu: donemKodu,
      baslangic_tarihi: baslangic,
      bitis_tarihi: bitis,
      varlik_acilis_tl: parseNumber(row[keys[1]]),
      varlik_acilis_usd: parseNumber(row[keys[2]]),
      nakit_giris_tl: parseNumber(row[keys[3]]),
      nakit_giris_usd: parseNumber(row[keys[4]]),
      nakit_cikis_tl: parseNumber(row[keys[5]]),
      nakit_cikis_usd: parseNumber(row[keys[6]]),
      varlik_tl: parseNumber(row[keys[7]]),
      varlik_usd: parseNumber(row[keys[8]]),
      yatirim_tl: parseNumber(row[keys[9]]),
      toplam_varlik_tl: parseNumber(row[keys[10]]),
      gayrinakit_islem: parseNumber(row[keys[11]]),
      toplam_piyasa_borcu: parseNumber(row[keys[12]]),
      toplam_kk_borc: parseNumber(row[keys[13]]),
      toplam_finansal_borc: parseNumber(row[keys[14]]),
      kur_bilgisi: parseNumber(row[keys[15]]),
    };

    const { data, error } = await supabase
      .from("nakit_donemler")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      console.error(`  Error inserting dönem ${donemKodu}:`, error.message);
    } else {
      donemMap.set(donemKodu, data.id);
      console.log(`  ✓ ${donemKodu} → ${data.id}`);
    }
  }
  console.log(`  Inserted ${donemMap.size} dönem records\n`);

  // ─── 2. Nakit Giriş (+) → nakit_girisler ─────────────────
  console.log("=== Step 2: Nakit Giriş (+) → nakit_girisler ===");
  const girisSheet = hasmobWb.Sheets["Nakit Giriş (+)"];
  if (!girisSheet) {
    console.error("Nakit Giriş (+) sheet not found!");
  } else {
    const girisRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(girisSheet);
    console.log(`  Found ${girisRows.length} rows`);
    if (girisRows.length > 0) {
      console.log("  Columns:", Object.keys(girisRows[0]).join(", "));
    }

    let girisInserted = 0;
    for (const row of girisRows) {
      const keys = Object.keys(row);
      const haftaKodu = String(row[keys[0]] || "").trim();
      const donemId = donemMap.get(haftaKodu);
      if (!donemId) {
        console.log(`  Skipping ${haftaKodu} — no matching dönem`);
        continue;
      }

      const record = {
        donem_id: donemId,
        vigowood_com: parseNumber(row[keys[1]]),
        trendyol: parseNumber(row[keys[2]]),
        hepsiburada: parseNumber(row[keys[3]]),
        amazon: parseNumber(row[keys[4]]),
        diger_pazaryeri: parseNumber(row[keys[5]]),
        has_mob: parseNumber(row[keys[6]]),
        doviz_satisi: parseNumber(row[keys[7]]),
        nakit_kredi: parseNumber(row[keys[8]]),
        toplam_tl: parseNumber(row[keys[9]]),
        amazon_yurtdisi: parseNumber(row[keys[10]]),
        diger_yurtdisi: parseNumber(row[keys[11]]),
        toplam_yurtdisi: parseNumber(row[keys[12]]),
      };

      const { error } = await supabase.from("nakit_girisler").insert(record);
      if (error) {
        console.error(`  Error inserting giriş ${haftaKodu}:`, error.message);
      } else {
        girisInserted++;
      }
    }
    console.log(`  Inserted ${girisInserted} nakit_girisler records\n`);
  }

  // ─── 3. Nakit Çıkışı (-) → nakit_cikislar ────────────────
  console.log("=== Step 3: Nakit Çıkışı (-) → nakit_cikislar ===");
  const cikisSheet = hasmobWb.Sheets["Nakit Çıkışı (-)"];
  if (!cikisSheet) {
    console.error("Nakit Çıkışı (-) sheet not found!");
  } else {
    const cikisRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(cikisSheet);
    console.log(`  Found ${cikisRows.length} rows`);
    if (cikisRows.length > 0) {
      console.log("  Columns:", Object.keys(cikisRows[0]).join(", "));
    }

    let cikisInserted = 0;
    for (const row of cikisRows) {
      const keys = Object.keys(row);
      const haftaKodu = String(row[keys[0]] || "").trim();
      const donemId = donemMap.get(haftaKodu);
      if (!donemId) {
        console.log(`  Skipping ${haftaKodu} — no matching dönem`);
        continue;
      }

      const record = {
        donem_id: donemId,
        // TL gider kategorileri (22)
        maas: parseNumber(row[keys[1]]),
        sgk: parseNumber(row[keys[2]]),
        hammadde: parseNumber(row[keys[3]]),
        akaryakit: parseNumber(row[keys[4]]),
        arac_bakim: parseNumber(row[keys[5]]),
        demirbas: parseNumber(row[keys[6]]),
        elektrik: parseNumber(row[keys[7]]),
        su: parseNumber(row[keys[8]]),
        pazaryeri: parseNumber(row[keys[9]]),
        telekom: parseNumber(row[keys[10]]),
        makine_bakim: parseNumber(row[keys[11]]),
        nakliye: parseNumber(row[keys[12]]),
        vergi: parseNumber(row[keys[13]]),
        mutfak: parseNumber(row[keys[14]]),
        hukuk: parseNumber(row[keys[15]]),
        muhasebe: parseNumber(row[keys[16]]),
        kredi_karti: parseNumber(row[keys[17]]),
        kredi_odemesi: parseNumber(row[keys[18]]),
        masraf_komisyon: parseNumber(row[keys[19]]),
        diger_giderler: parseNumber(row[keys[20]]),
        faaliyet_disi_harcamalar: parseNumber(row[keys[21]]),
        toplam_tl: parseNumber(row[keys[22]]),
        // USD gider kategorileri (5)
        gumruk_usd: parseNumber(row[keys[23]]),
        navlun_usd: parseNumber(row[keys[24]]),
        diger_usd: parseNumber(row[keys[25]]),
        doviz_bozdurma_usd: parseNumber(row[keys[26]]),
        toplam_yurtdisi_usd: parseNumber(row[keys[27]]),
      };

      const { error } = await supabase.from("nakit_cikislar").insert(record);
      if (error) {
        console.error(`  Error inserting çıkış ${haftaKodu}:`, error.message);
      } else {
        cikisInserted++;
      }
    }
    console.log(`  Inserted ${cikisInserted} nakit_cikislar records\n`);
  }

  // ─── 4. Ödemeler → odemeler ───────────────────────────────
  console.log("=== Step 4: Ödemeler → odemeler ===");
  const odemelerSheet = hasmobWb.Sheets["Ödemeler"];
  if (!odemelerSheet) {
    console.error("Ödemeler sheet not found!");
  } else {
    const odemelerRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(odemelerSheet);
    console.log(`  Found ${odemelerRows.length} rows`);
    if (odemelerRows.length > 0) {
      console.log("  Columns:", Object.keys(odemelerRows[0]).join(", "));
    }

    const batch: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const row of odemelerRows) {
      const keys = Object.keys(row);
      const tanimi = String(row[keys[0]] || "").trim();
      if (!tanimi) { skipped++; continue; }

      const tutar = parseNumber(row[keys[1]]);
      const cinsi = mapParaBirimi(row[keys[2]]);
      const tarihVal = row[keys[3]];
      const turu = mapOdemeTuru(row[keys[4]]);
      const odemeDurum = mapOdemeDurum(row[keys[5]]);

      // Parse date
      let tarih: string | null = null;
      if (tarihVal && typeof tarihVal === "number") {
        tarih = excelDateToISO(tarihVal);
      }

      const record: Record<string, unknown> = {
        tanimi,
        tutar,
        tarih,
        odeme_durum: odemeDurum,
      };

      // Only set cinsi/turu if valid enum value
      if (cinsi) record.cinsi = cinsi;
      if (turu) record.turu = turu;

      batch.push(record);
    }

    // Insert in batches of 100
    let inserted = 0;
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const { error } = await supabase.from("odemeler").insert(chunk);
      if (error) {
        console.error(`  Error batch ${i}:`, error.message);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`  Inserted ${inserted} odemeler records (skipped ${skipped})\n`);
  }

  // ─── 5. Nakit Giriş Takip → nakit_giris_takip ────────────
  console.log("=== Step 5: Nakit Giriş Takip → nakit_giris_takip ===");
  const takipSheet = hasmobWb.Sheets["Nakit Giriş Takip"];
  if (!takipSheet) {
    console.error("Nakit Giriş Takip sheet not found!");
  } else {
    const takipRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(takipSheet);
    console.log(`  Found ${takipRows.length} rows`);
    if (takipRows.length > 0) {
      console.log("  Columns:", Object.keys(takipRows[0]).join(", "));
    }

    let takipInserted = 0;
    for (const row of takipRows) {
      const keys = Object.keys(row);
      const tanimi = String(row[keys[0]] || "").trim();
      if (!tanimi) continue;

      const tutar = parseNumber(row[keys[1]]);
      const cinsi = mapParaBirimi(row[keys[2]]);
      const tarihVal = row[keys[3]];
      const turu = String(row[keys[4]] || "").trim() || null;
      const marka = String(row[keys[5]] || "").trim() || null;
      const odemeDurum = mapOdemeDurum(row[keys[6]]);

      let tarih: string | null = null;
      if (tarihVal && typeof tarihVal === "number") {
        tarih = excelDateToISO(tarihVal);
      }

      const record: Record<string, unknown> = {
        tanimi,
        tutar,
        tarih,
        turu,
        marka,
        odeme_durum: odemeDurum,
      };
      if (cinsi) record.cinsi = cinsi;

      const { error } = await supabase.from("nakit_giris_takip").insert(record);
      if (error) {
        console.error(`  Error inserting takip ${tanimi}:`, error.message);
      } else {
        takipInserted++;
      }
    }
    console.log(`  Inserted ${takipInserted} nakit_giris_takip records\n`);
  }

  // ═══════════════════════════════════════════════════════
  // PART B: FAALİYET HESAPLARI
  // ═══════════════════════════════════════════════════════

  console.log("Reading FALİYET HESAPLARI xlsx:", FAALIYET_PATH);
  const faaliyetWb = XLSX.readFile(FAALIYET_PATH);

  // ─── 6. SATIŞDATA → faaliyet_donemler + satis_giris ───────
  console.log("=== Step 6: SATIŞDATA → faaliyet_donemler + satis_giris ===");
  const satisDataSheet = faaliyetWb.Sheets["SATIŞDATA"];
  if (!satisDataSheet) {
    console.error("SATIŞDATA sheet not found!");
  } else {
    const satisRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(satisDataSheet);
    console.log(`  Found ${satisRows.length} rows`);
    if (satisRows.length > 0) {
      console.log("  Columns:", Object.keys(satisRows[0]).join(", "));
    }

    const fDonemMap = new Map<string, string>(); // donem_kodu → id
    let satisInserted = 0;

    for (const row of satisRows) {
      const keys = Object.keys(row);

      // Extract dönem info
      const donemKodu = String(row[keys[1]] || "").trim(); // DÖNEM_KOD
      if (!donemKodu || !donemKodu.match(/^\d{4}_\d{2}$/)) continue;

      const yil = parseNumber(row[keys[2]]);
      const ayNo = parseNumber(row[keys[3]]);
      const ceyrek = String(row[keys[4]] || "").trim();
      const yariYil = String(row[keys[5]] || "").trim();
      const kur = parseNumber(row[keys[15]]); // ORTALAMA_KUR

      // Create faaliyet dönem if not exists
      if (!fDonemMap.has(donemKodu)) {
        const ayLabels = [
          "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
          "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
        ];
        const donemLabel = `${ayLabels[ayNo] || ""} ${yil}`;

        const { data, error } = await supabase
          .from("faaliyet_donemler")
          .insert({
            donem_kodu: donemKodu,
            yil,
            ay_no: ayNo,
            ceyrek: ceyrek || "Q1",
            yari_yil: yariYil || "H1",
            donem_label: donemLabel,
            kur_tl_usd: kur,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`  Error inserting faaliyet dönem ${donemKodu}:`, error.message);
          continue;
        }
        fDonemMap.set(donemKodu, data.id);
        console.log(`  ✓ Faaliyet dönem: ${donemKodu} → ${data.id}`);
      }

      const donemId = fDonemMap.get(donemKodu)!;

      // Insert satis_giris record
      const marka = String(row[keys[6]] || "").trim();
      const kanal = String(row[keys[7]] || "").trim();
      const tur = mapFaaliyetTuru(row[keys[8]]);
      const pazaryeri = String(row[keys[9]] || "").trim();
      const ulke = String(row[keys[10]] || "").trim();

      const { error: satisError } = await supabase.from("satis_giris").insert({
        donem_id: donemId,
        marka,
        kanal,
        tur,
        pazaryeri,
        ulke: ulke || null,
        tl_satislar: parseNumber(row[keys[11]]),       // GİRİLEN_TL
        usd_satislar: parseNumber(row[keys[12]]),      // GİRİLEN_USD
        hesaplanan_tl: parseNumber(row[keys[13]]),     // TL_SATIŞLAR
        hesaplanan_usd: parseNumber(row[keys[14]]),    // USD_SATIŞLAR
        ortalama_kur: kur,
      });

      if (satisError) {
        console.error(`  Error inserting satış ${pazaryeri}:`, satisError.message);
      } else {
        satisInserted++;
      }
    }
    console.log(`  Inserted ${satisInserted} satis_giris records\n`);
  }

  // ─── 7. MALİYETDATA → maliyet_giris ──────────────────────
  console.log("=== Step 7: MALİYETDATA → maliyet_giris ===");
  const maliyetSheet = faaliyetWb.Sheets["MALİYETDATA"];
  if (!maliyetSheet) {
    console.error("MALİYETDATA sheet not found!");
  } else {
    const maliyetRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(maliyetSheet);
    console.log(`  Found ${maliyetRows.length} rows`);
    if (maliyetRows.length > 0) {
      console.log("  Columns:", Object.keys(maliyetRows[0]).join(", "));
    }

    // Get faaliyet dönem IDs
    const { data: fDonemler } = await supabase
      .from("faaliyet_donemler")
      .select("id, donem_kodu");
    const fDonemMap = new Map<string, string>();
    for (const d of fDonemler || []) {
      fDonemMap.set(d.donem_kodu, d.id);
    }

    const batch: Record<string, unknown>[] = [];

    for (const row of maliyetRows) {
      const keys = Object.keys(row);
      const donemKodu = String(row[keys[1]] || "").trim(); // DÖNEM_KOD
      const donemId = fDonemMap.get(donemKodu);
      if (!donemId) continue;

      const tur = mapFaaliyetTuru(row[keys[6]]);
      const kategori = String(row[keys[7]] || "").trim();
      const cariAdi = String(row[keys[8]] || "").trim();
      const marka = String(row[keys[9]] || "").trim();
      const kur = parseNumber(row[keys[12]]); // ORTALAMA_KUR
      const kaynak = String(row[keys[13]] || "").trim();

      batch.push({
        donem_id: donemId,
        tur,
        kategori,
        cari_adi: cariAdi || null,
        marka,
        tl_maliyet: parseNumber(row[keys[10]]),     // TL_MALİYET
        usd_maliyet: parseNumber(row[keys[11]]),    // USD_MALİYET
        ortalama_kur: kur,
        kaynak: kaynak || null,
      });
    }

    // Insert in batches
    let inserted = 0;
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const { error } = await supabase.from("maliyet_giris").insert(chunk);
      if (error) {
        console.error(`  Error batch ${i}:`, error.message);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`  Inserted ${inserted} maliyet_giris records\n`);
  }

  // ─── 8. KÂRLILIK DATA → karlilik_data ────────────────────
  console.log("=== Step 8: KÂRLILIK DATA → karlilik_data ===");
  const karlilikSheet = faaliyetWb.Sheets["KÂRLILIK DATA"];
  if (!karlilikSheet) {
    console.error("KÂRLILIK DATA sheet not found!");
  } else {
    const karlilikRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(karlilikSheet);
    console.log(`  Found ${karlilikRows.length} rows`);
    if (karlilikRows.length > 0) {
      console.log("  Columns:", Object.keys(karlilikRows[0]).join(", "));
    }

    // Get faaliyet dönem IDs
    const { data: fDonemler } = await supabase
      .from("faaliyet_donemler")
      .select("id, donem_kodu");
    const fDonemMap = new Map<string, string>();
    for (const d of fDonemler || []) {
      fDonemMap.set(d.donem_kodu, d.id);
    }

    const batch: Record<string, unknown>[] = [];

    for (const row of karlilikRows) {
      const keys = Object.keys(row);
      const donemKodu = String(row[keys[1]] || "").trim(); // DÖNEM_KOD
      const donemId = fDonemMap.get(donemKodu);
      if (!donemId) continue;

      const marka = String(row[keys[6]] || "").trim();
      const sira = parseNumber(row[keys[7]]);
      const kalemTuru = mapKalemTuru(row[keys[8]]);
      const kalem = String(row[keys[9]] || "").trim();
      // No AÇIKLAMA column in KÂRLILIK DATA — TL is at index 10
      const kur = parseNumber(row[keys[12]]); // ORTALAMA_KUR

      batch.push({
        donem_id: donemId,
        marka,
        sira,
        kalem_turu: kalemTuru,
        kalem,
        tl: parseNumber(row[keys[10]]),
        usd: parseNumber(row[keys[11]]),
        ortalama_kur: kur,
      });
    }

    // Insert in batches of 100
    let inserted = 0;
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const { error } = await supabase.from("karlilik_data").insert(chunk);
      if (error) {
        console.error(`  Error batch ${i}:`, error.message);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`  Inserted ${inserted} karlilik_data records\n`);
  }

  // ─── Summary ──────────────────────────────────────────────
  console.log("=== SUMMARY ===");
  const tables = [
    "nakit_donemler", "nakit_girisler", "nakit_cikislar",
    "odemeler", "nakit_giris_takip",
    "faaliyet_donemler", "satis_giris", "maliyet_giris", "karlilik_data",
  ];
  for (const t of tables) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count ?? 0} rows`);
  }

  console.log("\n✓ Muhasebe seed completed!");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
