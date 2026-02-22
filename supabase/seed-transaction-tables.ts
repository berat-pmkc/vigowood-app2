/**
 * VigoWood — Seed: Transaction Tables (Katman 5 — Excel)
 *
 * Imports 8 tables from Excel:
 *   cut_batches (748), cut_lines (1575), clean (1538), pack_events (712),
 *   hazir_eleman_akis (105), iade_giris (128), attendance (1891), notifications (2)
 *
 * Usage:
 *   npx tsx supabase/seed-transaction-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import XLSX from "xlsx";

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

const BATCH_SIZE = 100;
const EXCEL_PATH = resolve(process.cwd(), "..", "data", "VIGO WOOD APP DATA.xlsx");

// ─── HELPERS ─────────────────────────────────────────────────

async function batchUpsert(table: string, data: Record<string, any>[], conflictCol: string) {
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol });
    if (error) {
      console.error(`  ❌ ${table} batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

async function batchInsert(table: string, data: Record<string, any>[]) {
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ❌ ${table} batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

// Parse Excel date: serial number or string → ISO timestamp
function parseTimestamp(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    return d.toISOString();
  }
  const s = String(val).trim();
  if (!s) return null;
  // Try direct ISO parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// Parse date-only (no time) → YYYY-MM-DD
function parseDateOnly(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    return d.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

// Parse time string "HH:mm:ss" → keep as-is
function parseTime(val: any): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Excel might give decimal for time
  if (typeof val === "number") {
    const totalSec = Math.round(val * 86400);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return s;
}

// MakineID mapping: ASCII → new IDs
const MAKINE_MAP: Record<string, string> = {
  BUYUK: "MAK-2",
  KUCUK: "MAK-1",
  KUTU: "KUTU",
  // Legacy Turkish names (in case DB already has them)
  "BÜYÜK": "MAK-2",
  "KÜÇÜK": "MAK-1",
};

function readSheet(sheetName: string): Record<string, any>[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
}

// ─── 1. CUT_BATCHES ─────────────────────────────────────────
async function seedCutBatches() {
  console.log("\n✂️  CutBatches seed başlatılıyor...");
  const rows = readSheet("CutBatches");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["CutID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      cut_id: String(r["CutID"]).trim(),
      tarih: parseTimestamp(r["Tarih"]),
      sku: r["SKU"] ? String(r["SKU"]).trim() : null,
      plaka_id: r["PlakaID"] ? String(r["PlakaID"]).trim() : null,
      makine_id: r["MakineID"] ? MAKINE_MAP[String(r["MakineID"]).trim()] || String(r["MakineID"]).trim() : null,
      adet: r["Adet"] != null ? Number(r["Adet"]) : 0,
      operator_id: r["Operator"] ? String(r["Operator"]).trim() : null,
      plk_notu: r["PLK Notu"] ? String(r["PLK Notu"]).trim() : null,
      email: r["Email"] ? String(r["Email"]).trim() : null,
    }));

  const inserted = await batchUpsert("cut_batches", data, "cut_id");
  console.log(`  ✅ ${inserted} kesim partisi eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 2. CUT_LINES ───────────────────────────────────────────
async function seedCutLines() {
  console.log("\n📏 CutLines seed başlatılıyor...");
  const rows = readSheet("CutLines");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["CutLineID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      cut_line_id: String(r["CutLineID"]).trim(),
      cut_id: String(r["CutID"] || "").trim(),
      tarih: parseTimestamp(r["Tarih"]),
      part_id: r["PartID"] ? String(r["PartID"]).trim() : null,
      adet: r["Adet"] != null ? Number(r["Adet"]) : 0,
      not_text: r["Not"] ? String(r["Not"]).trim() : null,
      renk: r["Renk"] ? String(r["Renk"]).trim() : null,
      email: r["Email"] ? String(r["Email"]).trim() : null,
    }));

  const inserted = await batchUpsert("cut_lines", data, "cut_line_id");
  console.log(`  ✅ ${inserted} kesim satırı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 3. CLEAN ────────────────────────────────────────────────
async function seedClean(existingCutLineIds: Set<string>) {
  console.log("\n🧹 Clean seed başlatılıyor...");
  const rows = readSheet("Clean");

  let skippedFk = 0;
  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      // CutlineID is unique PK
      const id = String(r["CutlineID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      // Check FK: cutline_id must exist in cut_lines
      if (!existingCutLineIds.has(id)) { skippedFk++; return false; }
      return true;
    })
    .map((r) => ({
      cutline_id: String(r["CutlineID"]).trim(),
      clean_batch_id: String(r["CleanID"] || "").trim(),
      start_time: parseTimestamp(r["StartTime"]),
      end_time: parseTimestamp(r["EndTime"]),
      status: r["Status"] ? String(r["Status"]).trim() : "Closed",
      not_text: r["Not"] ? String(r["Not"]).trim() : null,
      email: r["Email"] ? String(r["Email"]).trim() : null,
    }));

  if (skippedFk > 0) console.log(`  ⚠️  ${skippedFk} satır atlandı (cutline_id cut_lines'ta yok)`);
  const inserted = await batchUpsert("clean", data, "cutline_id");
  console.log(`  ✅ ${inserted} temizlik kaydı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 4. PACK_EVENTS ─────────────────────────────────────────
async function seedPackEvents() {
  console.log("\n📦 PackEvents seed başlatılıyor...");
  const rows = readSheet("PackEvents");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["SessionID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      session_id: String(r["SessionID"]).trim(),
      email: r["Email"] ? String(r["Email"]).trim() : null,
      tarih: parseTimestamp(r["Tarih"]),
      sku: r["SKU"] ? String(r["SKU"]).trim() : null,
      personel: r["Personel"] ? String(r["Personel"]).trim() : null,
      start_time: parseTimestamp(r["StartTime"]),
      end_time: parseTimestamp(r["EndTime"]),
      qty: r["Qty"] != null ? Number(r["Qty"]) : 0,
      not_text: r["Not"] ? String(r["Not"]).trim() : null,
      status: r["Status"] ? String(r["Status"]).trim() : "Closed",
    }));

  const inserted = await batchUpsert("pack_events", data, "session_id");
  console.log(`  ✅ ${inserted} paketleme seansı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 5. HAZIR_ELEMAN_AKIS ───────────────────────────────────
async function seedHazirElemanAkis() {
  console.log("\n🔧 HazırElemanAkış seed başlatılıyor...");
  const rows = readSheet("HazırElemanAkıs");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["HAkısID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      hakis_id: String(r["HAkısID"]).trim(),
      tarih: parseTimestamp(r["Tarih"]),
      part_id: r["PartID"] ? String(r["PartID"]).trim() : null,
      qty: r["Qty"] != null ? Number(r["Qty"]) : 0,
      operator: r["Operator"] ? String(r["Operator"]).trim() : null,
    }));

  const inserted = await batchUpsert("hazir_eleman_akis", data, "hakis_id");
  console.log(`  ✅ ${inserted} hazır eleman akış kaydı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 6. IADE_GIRIS ──────────────────────────────────────────
async function seedIadeGiris() {
  console.log("\n↩️  İadeGiriş seed başlatılıyor...");
  const rows = readSheet("iadeGiris");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["iadeID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      iade_id: String(r["iadeID"]).trim(),
      tarih: parseTimestamp(r["Date"]),
      sku: r["SKU"] ? String(r["SKU"]).trim() : null,
      qty: r["Qty"] != null ? Number(r["Qty"]) : 0,
      durum: r["Durum"] ? String(r["Durum"]).trim() : null,
    }));

  const inserted = await batchUpsert("iade_giris", data, "iade_id");
  console.log(`  ✅ ${inserted} iade kaydı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 7. ATTENDANCE ──────────────────────────────────────────
async function seedAttendance() {
  console.log("\n📋 Attendance seed başlatılıyor...");
  const rows = readSheet("Attendance");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["AttID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      att_id: String(r["AttID"]).trim(),
      tarih: parseDateOnly(r["Date"]),
      employee: r["Employee"] ? String(r["Employee"]).trim() : "",
      department: r["Department"] ? String(r["Department"]).trim() : null,
      start_time: parseTime(r["StartTime"]),
      end_time: parseTime(r["EndTime"]),
      not_text: r["Note"] ? String(r["Note"]).trim() : null,
    }));

  const inserted = await batchUpsert("attendance", data, "att_id");
  console.log(`  ✅ ${inserted} yoklama kaydı eklendi (${rows.length} total)`);
  return inserted;
}

// ─── 8. NOTIFICATIONS ───────────────────────────────────────
async function seedNotifications() {
  console.log("\n🔔 Notifications seed başlatılıyor...");
  const rows = readSheet("Notifications");

  const seen = new Set<string>();
  const data = rows
    .filter((r) => {
      const id = String(r["NotifID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
      notif_id: String(r["NotifID"]).trim(),
      title: r["Title"] ? String(r["Title"]).trim() : "",
      message: r["Message"] ? String(r["Message"]).trim() : null,
      target_user: r["TargetUser"] ? String(r["TargetUser"]).trim() : null,
      status: r["Status"] ? String(r["Status"]).trim() : "Yeni",
      created_by: r["CreatedBy"] ? String(r["CreatedBy"]).trim() : null,
      attachments: r["Attachments"] ? String(r["Attachments"]).trim() : null,
      created_at: parseTimestamp(r["CreatedAt"]),
    }));

  const inserted = await batchUpsert("notifications", data, "notif_id");
  console.log(`  ✅ ${inserted} bildirim eklendi (${rows.length} total)`);
  return inserted;
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Katman 5 — İşlem tabloları (Excel) seed başlatılıyor...\n");

  // Order matters: cut_batches → cut_lines → clean (FK chain)
  const cutBatches = await seedCutBatches();
  const cutLines = await seedCutLines();

  // Fetch existing cut_line_ids for clean FK validation
  console.log("\n  📡 Mevcut cut_line_id'ler çekiliyor...");
  const existingCutLineIds = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("cut_lines").select("cut_line_id").range(from, from + 999);
    if (error || !data || data.length === 0) break;
    data.forEach((r) => existingCutLineIds.add(r.cut_line_id));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`  📡 ${existingCutLineIds.size} cut_line_id bulundu`);

  const clean = await seedClean(existingCutLineIds);
  const packEvents = await seedPackEvents();
  const hazirEleman = await seedHazirElemanAkis();
  const iadeGiris = await seedIadeGiris();
  const attendance = await seedAttendance();
  const notifications = await seedNotifications();

  console.log("\n📊 Sonuç:");
  console.log(`   CutBatches:       ${cutBatches}`);
  console.log(`   CutLines:         ${cutLines}`);
  console.log(`   Clean:            ${clean}`);
  console.log(`   PackEvents:       ${packEvents}`);
  console.log(`   HazırElemanAkış:  ${hazirEleman}`);
  console.log(`   İadeGiriş:        ${iadeGiris}`);
  console.log(`   Attendance:       ${attendance}`);
  console.log(`   Notifications:    ${notifications}`);
}

main().catch(console.error);
