/**
 * VigoWood — Seed: Large CSV Tables (Katman 5)
 *
 * Imports:
 *   stock_movements (20752 rows) — StockMovements CSV
 *   yari_mamul_stok (234141 rows) — YarıMamulStok CSV
 *
 * Handles:
 *   - StockMovements: DD.M.YYYY date format, duplicate MovIDs, UUID surrogate PK
 *   - YarıMamulStok: Two row formats (20% shifted columns), multiple date formats
 *
 * Usage:
 *   npx tsx supabase/seed-large-csv.ts
 *   npx tsx supabase/seed-large-csv.ts stock    # only stock_movements
 *   npx tsx supabase/seed-large-csv.ts yms      # only yari_mamul_stok
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Run from project root.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH_SIZE = 500;
const DATA_DIR = resolve(process.cwd(), "..", "data");

// ─── DATE PARSERS ────────────────────────────────────────────

// StockMovements: mixed date format — "15.12.2025" (D.M.YYYY) and "11.30.2025" (M.D.YYYY)
// Smart detection: if first > 12 → D.M.YYYY, if second > 12 → M.D.YYYY, else M.D.YYYY (default)
function parseStockDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const s = val.trim();

  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    const n1 = parseInt(m[1]);
    const n2 = parseInt(m[2]);
    const y = m[3];
    const h = m[4] || "0";
    const mi = m[5] || "00";
    const sec = m[6] || "00";

    let month: number, day: number;
    if (n1 > 12) {
      // First must be day (D.M.YYYY)
      day = n1; month = n2;
    } else if (n2 > 12) {
      // Second must be day (M.D.YYYY)
      month = n1; day = n2;
    } else {
      // Both ≤ 12: default to M.D.YYYY (matches BatchID evidence)
      month = n1; day = n2;
    }

    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${sec}+03:00`;
  }

  // Try ISO parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// YariMamulStok Format A: "02/13/2026 10:11:05" → ISO (MM/DD/YYYY — US format with slashes)
// YariMamulStok Format B: "Tue Feb 17 2026 11:36:26 GMT+0300 (GMT+03:00)" → ISO
// YariMamulStok Format C: "1.12.2025 09:27" → ISO (D.M.YYYY HH:mm — Turkish locale, dot-separated)
function parseYmsDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const s = val.trim();

  // MM/DD/YYYY HH:mm:ss (US format with slashes)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const n1 = parseInt(m[1]);
    const n2 = parseInt(m[2]);
    const y = m[3];
    const h = m[4];
    const mi = m[5];
    const sec = m[6];

    let month: number, day: number;
    if (n1 > 12) {
      // First must be day (D/M/YYYY)
      day = n1; month = n2;
    } else if (n2 > 12) {
      // Second must be day (M/D/YYYY)
      month = n1; day = n2;
    } else {
      // Both ≤ 12: default M/D/YYYY (US format, matches data evidence)
      month = n1; day = n2;
    }

    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${sec}+03:00`;
  }

  // D.M.YYYY HH:mm or D.M.YYYY HH:mm:ss (dot-separated, Turkish locale)
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dotMatch) {
    const n1 = parseInt(dotMatch[1]);
    const n2 = parseInt(dotMatch[2]);
    const y = dotMatch[3];
    const h = dotMatch[4];
    const mi = dotMatch[5];
    const sec = dotMatch[6] || "00";

    let month: number, day: number;
    if (n1 > 12) {
      day = n1; month = n2;
    } else if (n2 > 12) {
      month = n1; day = n2;
    } else {
      // D.M.YYYY — Turkish format: first is day
      day = n1; month = n2;
    }

    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${sec}+03:00`;
  }

  // JS Date string: "Tue Feb 17 2026 11:36:26 GMT+0300..."
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString();

  return null;
}

// ─── CSV LINE PARSER ─────────────────────────────────────────
// Simple CSV parser: handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── STOCK_MOVEMENTS (20752 rows) ───────────────────────────
async function seedStockMovements() {
  console.log("\n📈 StockMovements seed başlatılıyor...");

  const filePath = resolve(DATA_DIR, "StockMovements.csv");
  const rl = createInterface({ input: createReadStream(filePath, "utf-8") });

  let headers: string[] = [];
  let lineNum = 0;
  let batch: Record<string, any>[] = [];
  let inserted = 0;
  let errors = 0;

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headers = parseCSVLine(line);
      continue;
    }

    const cols = parseCSVLine(line);
    if (cols.length < 7) continue;

    const movId = cols[0] || null;
    const tarih = parseStockDate(cols[1]);
    const sku = cols[2] || null;
    const qty = cols[3] ? Number(cols[3]) : 0;
    const source = cols[4] || null;
    const sourceRowId = cols[5] || null;
    const batchId = cols[6] || null;

    batch.push({
      mov_id: movId,
      tarih,
      sku,
      qty: isNaN(qty) ? 0 : qty,
      source,
      source_row_id: sourceRowId,
      batch_id: batchId,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("stock_movements").insert(batch);
      if (error) {
        console.error(`  ❌ batch at line ${lineNum} error:`, error.message);
        errors++;
      } else {
        inserted += batch.length;
      }
      batch = [];

      if (inserted % 5000 === 0 && inserted > 0) {
        console.log(`  ... ${inserted} satır eklendi`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const { error } = await supabase.from("stock_movements").insert(batch);
    if (error) {
      console.error(`  ❌ final batch error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted} stok hareketi eklendi (${lineNum - 1} total, ${errors} hatalı batch)`);
  return inserted;
}

// ─── YARI_MAMUL_STOK (234141 rows) ─────────────────────────
async function seedYariMamulStok() {
  console.log("\n📊 YarıMamulStok seed başlatılıyor (234K satır, bu biraz sürebilir)...");

  const filePath = resolve(DATA_DIR, "YarıMamulStok.csv");
  const rl = createInterface({ input: createReadStream(filePath, "utf-8") });

  let headers: string[] = [];
  let lineNum = 0;
  let batch: Record<string, any>[] = [];
  let inserted = 0;
  let errors = 0;
  let formatA = 0;
  let formatB = 0;
  let skipped = 0;

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headers = parseCSVLine(line);
      continue;
    }

    const cols = parseCSVLine(line);
    if (cols.length < 10) {
      skipped++;
      continue;
    }

    const ymsId = cols[0];
    if (!ymsId) { skipped++; continue; }

    let tarih: string | null;
    let partId: string | null;
    let partAdi: string | null;
    let sku: string | null;
    let qty: number;
    let direction: string | null;
    let source: string | null;
    let sourceId: string | null;
    let operator: string | null;

    // Detect format: Format A has date with slash or dot in cols[1], Format B has empty/non-date cols[1]
    if (cols[1] && /^\d{1,2}[./]\d{1,2}[./]\d{4}/.test(cols[1].trim())) {
      // Format A: normal column order
      // YMSID, Tarih, PartID, PartAdi, SKU, Qty, Direction, Source, SourceID, Operator
      formatA++;
      tarih = parseYmsDate(cols[1]);
      partId = cols[2] || null;
      partAdi = cols[3] || null;
      sku = cols[4] || null;
      qty = cols[5] ? Number(cols[5]) : 0;
      direction = cols[6] || null;
      source = cols[7] || null;
      sourceId = cols[8] || null;
      operator = cols[9] || null;
    } else {
      // Format B: shifted columns (cols[1] empty or non-date, date is in cols[2] as JS Date string)
      // YMSID, (empty), Tarih(JS Date), PartID, PartAdi, SKU, Qty, Direction, Source, SourceID, Operator
      formatB++;
      tarih = parseYmsDate(cols[2] || "");
      partId = cols[3] || null;
      partAdi = cols[4] || null;
      sku = cols[5] || null;
      qty = cols[6] ? Number(cols[6]) : 0;
      direction = cols[7] || null;
      source = cols[8] || null;
      sourceId = cols[9] || null;
      operator = cols.length > 10 ? cols[10] || null : null;
    }

    batch.push({
      yms_id: ymsId,
      tarih,
      part_id: partId,
      part_adi: partAdi,
      sku,
      qty: isNaN(qty) ? 0 : qty,
      direction: direction || null,
      source,
      source_id: sourceId,
      operator,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("yari_mamul_stok").upsert(batch, { onConflict: "yms_id" });
      if (error) {
        console.error(`  ❌ batch at line ${lineNum} error:`, error.message);
        errors++;
      } else {
        inserted += batch.length;
      }
      batch = [];

      if (inserted % 25000 === 0 && inserted > 0) {
        console.log(`  ... ${inserted} satır eklendi`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const { error } = await supabase.from("yari_mamul_stok").upsert(batch, { onConflict: "yms_id" });
    if (error) {
      console.error(`  ❌ final batch error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  📊 Format A (normal): ${formatA}, Format B (shifted): ${formatB}, skipped: ${skipped}`);
  console.log(`  ✅ ${inserted} yarı mamül stok kaydı eklendi (${lineNum - 1} total, ${errors} hatalı batch)`);
  return inserted;
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];

  console.log("🌱 Katman 5 — Büyük CSV tabloları seed başlatılıyor...\n");

  if (!arg || arg === "stock") {
    await seedStockMovements();
  }

  if (!arg || arg === "yms") {
    await seedYariMamulStok();
  }

  console.log("\n✅ CSV seed tamamlandı.");
}

main().catch(console.error);
