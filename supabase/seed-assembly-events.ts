/**
 * VigoWood — Seed: Assembly Events → montaj_sessions
 *
 * Imports 3464 historical assembly events from CSV into montaj_sessions table.
 * Only CLOSE (tamamlandi) records are inserted. OPEN records are skipped.
 *
 * Enriches with:
 *   - assembly_steps: step_name, seq_no, is_final_step
 *   - users: operator full_name
 *   - Computed: worker_count, workers JSON, birim_montaj_dk
 *
 * Idempotent: upserts on session_id (EventID).
 * Does NOT touch stock — PostedToStock is informational only.
 *
 * Usage:
 *   npx tsx supabase/seed-assembly-events.ts
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
  console.error("Missing env vars. Run from project root (vigowood-app/).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH_SIZE = 100;
const DATA_DIR = resolve(process.cwd(), "..", "data");

// ─── CSV LINE PARSER ─────────────────────────────────────────
// Handles quoted fields with commas (e.g. "VW016 , VW021")
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

// ─── DATE PARSER ─────────────────────────────────────────────
// CSV format: M/D/YYYY H:MM:SS (US format) or M/D/YYYY (date only)
// Returns ISO 8601 with +03:00 timezone (Turkey)
function parseDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const s = val.trim();

  // M/D/YYYY H:MM:SS
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/
  );
  if (m) {
    const n1 = parseInt(m[1]);
    const n2 = parseInt(m[2]);
    const y = m[3];
    const h = m[4] || "0";
    const mi = m[5] || "00";
    const sec = m[6] || "00";

    // Smart detect: if first > 12 → D/M/YYYY, else M/D/YYYY (US default)
    let month: number, day: number;
    if (n1 > 12) {
      day = n1;
      month = n2;
    } else if (n2 > 12) {
      month = n1;
      day = n2;
    } else {
      // Both ≤ 12: default M/D/YYYY (US format — matches CSV evidence)
      month = n1;
      day = n2;
    }

    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${sec}+03:00`;
  }

  return null;
}

// ─── OPERATOR PARSER ─────────────────────────────────────────
// Single: "VW031" → ["VW031"]
// Multiple: "VW016 , VW021" → ["VW016", "VW021"]
// Multiple: "VW041 , VW016 , VW025" → ["VW041", "VW016", "VW025"]
function parseOperators(val: string): string[] {
  if (!val || !val.trim()) return [];
  return val
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  console.log("🔧 Montaj geçmiş verileri seed başlatılıyor...\n");

  // ── Step 1: Fetch lookup tables ──
  console.log("📋 Lookup tabloları çekiliyor...");

  const { data: stepsData, error: stepsErr } = await supabase
    .from("assembly_steps")
    .select("step_id, step_name, seq_no, is_final_step, sku");

  if (stepsErr) {
    console.error("❌ assembly_steps çekilemedi:", stepsErr.message);
    process.exit(1);
  }

  // Map: step_id → { step_name, seq_no, is_final_step }
  const stepsMap = new Map<
    string,
    { step_name: string; seq_no: number; is_final_step: boolean }
  >();
  for (const s of stepsData || []) {
    stepsMap.set(s.step_id, {
      step_name: s.step_name,
      seq_no: s.seq_no,
      is_final_step: s.is_final_step ?? false,
    });
  }
  console.log(`  → ${stepsMap.size} assembly_steps yüklendi`);

  const { data: usersData, error: usersErr } = await supabase
    .from("users")
    .select("user_id, full_name");

  if (usersErr) {
    console.error("❌ users çekilemedi:", usersErr.message);
    process.exit(1);
  }

  // Map: user_id → full_name
  const usersMap = new Map<string, string>();
  for (const u of usersData || []) {
    usersMap.set(u.user_id, u.full_name);
  }
  console.log(`  → ${usersMap.size} users yüklendi`);

  // ── Step 2: Parse CSV ──
  console.log("\n📄 CSV okunuyor...");

  const filePath = resolve(
    DATA_DIR,
    "AssemblyEvents - AssemblyEvents.csv"
  );
  const rl = createInterface({ input: createReadStream(filePath, "utf-8") });

  let lineNum = 0;
  // Use Map to deduplicate by session_id (last occurrence wins)
  const rowsMap = new Map<string, Record<string, any>>();

  // Stats
  let totalClose = 0;
  let totalOpen = 0;
  let multiOperator = 0;
  let missingStep = 0;
  let missingUser = 0;
  let emptyAdet = 0;
  let duplicates = 0;

  for await (const line of rl) {
    lineNum++;

    // Skip header
    if (lineNum === 1) continue;

    // Skip empty lines
    if (!line.trim()) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 12) {
      console.warn(`  ⚠️ Satır ${lineNum}: yetersiz kolon (${cols.length})`);
      continue;
    }

    // CSV columns:
    // 0: EventID, 1: Tarih, 2: Operatör, 3: SKU, 4: StepID,
    // 5: StartTime, 6: EndTime, 7: Adet, 8: PostedToStock,
    // 9: Not, 10: Email, 11: Status
    const eventId = cols[0];
    const operatorRaw = cols[2];
    const sku = cols[3];
    const stepId = cols[4];
    const startTimeRaw = cols[5];
    const endTimeRaw = cols[6];
    const adetRaw = cols[7];
    const notes = cols[9] || null;
    const email = cols[10] || null;
    const status = cols[11];

    // Skip OPEN records (unfinished sessions)
    if (status === "OPEN") {
      totalOpen++;
      continue;
    }

    totalClose++;

    // Parse operators
    const operators = parseOperators(operatorRaw);
    const primaryOperator = operators[0] || null;
    const workerCount = operators.length || 1;

    if (operators.length > 1) multiOperator++;

    // Build workers JSON
    const workers = operators.map((id) => ({
      id,
      name: usersMap.get(id) || id,
    }));

    // Get operator name
    const operatorName = primaryOperator
      ? usersMap.get(primaryOperator) || primaryOperator
      : null;

    if (primaryOperator && !usersMap.has(primaryOperator)) missingUser++;

    // Lookup step info
    const stepInfo = stepsMap.get(stepId);
    if (!stepInfo) missingStep++;

    // Parse dates
    const startTime = parseDate(startTimeRaw);
    const endTime = parseDate(endTimeRaw);
    const createdAt = parseDate(cols[1]) || startTime;

    // Parse adet
    const qty = adetRaw ? Number(adetRaw) : 0;
    if (!adetRaw || isNaN(Number(adetRaw))) emptyAdet++;

    // Calculate birim_montaj_dk for CLOSE records with valid times
    let birimMontajDk: number | null = null;
    if (startTime && endTime && qty > 0) {
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      const diffMinutes = (endMs - startMs) / (1000 * 60);

      if (diffMinutes > 0) {
        birimMontajDk =
          Math.round((diffMinutes / (qty * workerCount)) * 100) / 100;
      }
    }

    if (rowsMap.has(eventId)) duplicates++;

    rowsMap.set(eventId, {
      session_id: eventId,
      sku,
      step_id: stepId,
      step_name: stepInfo?.step_name || null,
      seq_no: stepInfo?.seq_no ?? null,
      is_final_step: stepInfo?.is_final_step ?? false,
      durum: "tamamlandi",
      email,
      operator_id: primaryOperator,
      operator_name: operatorName,
      start_time: startTime,
      end_time: endTime,
      qty: isNaN(qty) ? 0 : qty,
      worker_count: workerCount,
      workers,
      birim_montaj_dk: birimMontajDk,
      notes,
      created_at: createdAt,
    });
  }

  const rows = Array.from(rowsMap.values());

  console.log(`  → ${lineNum - 1} satır okundu`);
  console.log(`  → ${totalClose} CLOSE (eklenecek), ${totalOpen} OPEN (atlanacak)`);
  console.log(`  → ${duplicates} duplicate EventID (son kayıt korundu)`);
  console.log(`  → ${rows.length} unique kayıt`);
  console.log(`  → ${multiOperator} çoklu operatör kaydı`);
  console.log(`  → ${missingStep} eksik step_id (assembly_steps'te yok)`);
  console.log(`  → ${missingUser} eksik operatör (users'ta yok)`);
  if (emptyAdet > 0) console.log(`  → ${emptyAdet} boş/geçersiz adet`);

  // ── Step 3: Batch upsert ──
  console.log(`\n📤 ${rows.length} kayıt montaj_sessions'a yazılıyor...`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("montaj_sessions")
      .upsert(batch, { onConflict: "session_id" });

    if (error) {
      console.error(
        `  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} hata:`,
        error.message
      );
      errors++;

      // Try inserting one by one to find the problematic row
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from("montaj_sessions")
          .upsert(row, { onConflict: "session_id" });
        if (singleErr) {
          console.error(
            `    → ${row.session_id}: ${singleErr.message}`
          );
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if (inserted % 500 === 0 && inserted > 0) {
      console.log(`  ... ${inserted} kayıt eklendi`);
    }
  }

  console.log(`\n✅ Seed tamamlandı!`);
  console.log(`   Toplam eklenen: ${inserted}`);
  console.log(`   Hatalı batch: ${errors}`);
  console.log(`   OPEN atlanan: ${totalOpen}`);
}

main().catch(console.error);
