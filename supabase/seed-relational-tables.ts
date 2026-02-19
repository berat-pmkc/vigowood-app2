/**
 * VigoWood — Seed: Relational Tables (Katman 4)
 *
 * Imports plakalar (416), plaka_parts (406), assembly_steps (523),
 * step_bom (1651) from Excel to Supabase.
 *
 * Usage:
 *   npx tsx supabase/seed-relational-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import XLSX from "xlsx";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Run from project root: npx tsx supabase/seed-relational-tables.ts");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH_SIZE = 100;
const EXCEL_PATH = resolve(process.cwd(), "..", "data", "VIGO WOOD APP DATA.xlsx");

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

// Fetch existing reference data from Supabase
async function fetchExistingSkus(): Promise<Set<string>> {
  const skus = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from("products").select("sku").range(from, from + PAGE - 1);
    if (error) { console.error("  ❌ Products fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    data.forEach((r) => skus.add(r.sku));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return skus;
}

async function fetchExistingPartIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from("all_parts").select("part_id").range(from, from + PAGE - 1);
    if (error) { console.error("  ❌ AllParts fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    data.forEach((r) => ids.add(r.part_id));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function fetchExistingMakineIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data, error } = await supabase.from("kesim_makinesi").select("makine_id");
  if (error) { console.error("  ❌ KesimMakinesi fetch error:", error.message); return ids; }
  data?.forEach((r) => ids.add(r.makine_id));
  return ids;
}

// ─── PLAKALAR (416 rows) ────────────────────────────────────
async function seedPlakalar(existingSkus: Set<string>, existingMakine: Set<string>) {
  console.log("\n🪵 Plakalar seed başlatılıyor...");

  const wb = XLSX.readFile(EXCEL_PATH);
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["Plakalar"]);

  // Deduplicate by PlakalarID — keep first occurrence
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const id = String(r["PlakalarID"] || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const skipped = rows.length - uniqueRows.length;
  if (skipped > 0) console.log(`  ⚠️  ${skipped} duplicate PlakalarID atlandı`);

  let nulledSkus = 0;
  let skippedMakine = 0;

  const plakalar = uniqueRows
    .filter((r) => {
      const makineId = String(r["MakineID"] || "").trim();
      if (!existingMakine.has(makineId)) {
        skippedMakine++;
        return false;
      }
      return true;
    })
    .map((r) => {
      const sku = r["SKU"] ? String(r["SKU"]).trim() : null;
      if (sku && !existingSkus.has(sku)) {
        nulledSkus++;
        return {
          plakalar_id: String(r["PlakalarID"]).trim(),
          plaka_id: String(r["PlakaID"] || "").trim(),
          plaka_adi: String(r["PlakaAdı"] || "").trim(),
          sku: null,
          tipi: r["Tipi"] ? String(r["Tipi"]).trim() : null,
          renk: r["Renk"] ? String(r["Renk"]).trim() : null,
          makine_id: String(r["MakineID"] || "").trim(),
          std_kesim_suresi_dk: r["StdKesimSüresiDk"] != null ? Number(r["StdKesimSüresiDk"]) : null,
        };
      }
      return {
        plakalar_id: String(r["PlakalarID"]).trim(),
        plaka_id: String(r["PlakaID"] || "").trim(),
        plaka_adi: String(r["PlakaAdı"] || "").trim(),
        sku: sku,
        tipi: r["Tipi"] ? String(r["Tipi"]).trim() : null,
        renk: r["Renk"] ? String(r["Renk"]).trim() : null,
        makine_id: String(r["MakineID"] || "").trim(),
        std_kesim_suresi_dk: r["StdKesimSüresiDk"] != null ? Number(r["StdKesimSüresiDk"]) : null,
      };
    });

  if (nulledSkus > 0) console.log(`  ⚠️  ${nulledSkus} satırda SKU null yapıldı (products'ta yok)`);
  if (skippedMakine > 0) console.log(`  ⚠️  ${skippedMakine} satır atlandı (makine_id yok)`);

  const inserted = await batchUpsert("plakalar", plakalar, "plakalar_id");
  console.log(`  ✅ ${inserted} plaka eklendi`);
  return inserted;
}

// ─── PLAKA_PARTS (406 rows) ─────────────────────────────────
async function seedPlakaParts(existingPartIds: Set<string>, existingSkus: Set<string>) {
  console.log("\n🧩 PlakaParts seed başlatılıyor...");

  const wb = XLSX.readFile(EXCEL_PATH);
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["PlakaParts"]);

  let skippedParts = 0;
  let nulledSkus = 0;

  const plakaParts = rows
    .filter((r) => {
      const partId = String(r["PartID"] || "").trim();
      if (!existingPartIds.has(partId)) {
        skippedParts++;
        return false;
      }
      return true;
    })
    .map((r) => {
      let qty: number | null = null;
      if (r["DefaultQty"] != null) {
        const parsed = Number(r["DefaultQty"]);
        qty = isNaN(parsed) ? null : parsed;
      }

      const sku = r["SKU"] ? String(r["SKU"]).trim() : null;
      if (sku && !existingSkus.has(sku)) nulledSkus++;

      return {
        ppart_id: String(r["PPartID"]).trim(),
        plaka_id: String(r["PlakaID"] || "").trim(),
        part_id: String(r["PartID"] || "").trim(),
        default_qty: qty,
        sku: sku && existingSkus.has(sku) ? sku : null,
      };
    });

  if (skippedParts > 0) console.log(`  ⚠️  ${skippedParts} satır atlandı (part_id all_parts'ta yok)`);
  if (nulledSkus > 0) console.log(`  ⚠️  ${nulledSkus} satırda SKU null yapıldı`);

  const inserted = await batchUpsert("plaka_parts", plakaParts, "ppart_id");
  console.log(`  ✅ ${inserted} plaka-part eklendi`);
  return inserted;
}

// ─── ASSEMBLY_STEPS (523 rows) ──────────────────────────────
async function seedAssemblySteps(existingSkus: Set<string>) {
  console.log("\n🔧 AssemblySteps seed başlatılıyor...");

  const wb = XLSX.readFile(EXCEL_PATH);
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["AssemblySteps"]);

  // Deduplicate by StepID — keep first occurrence
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const id = String(r["StepID"] || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const skipped = rows.length - uniqueRows.length;
  if (skipped > 0) console.log(`  ⚠️  ${skipped} duplicate StepID atlandı`);

  let nulledSkus = 0;

  const steps = uniqueRows.map((r) => {
    const sku = r["SKU"] ? String(r["SKU"]).trim() : null;
    if (sku && !existingSkus.has(sku)) {
      nulledSkus++;
      return {
        step_id: String(r["StepID"]).trim(),
        sku: null,
        step_name: r["StepName"] ? String(r["StepName"]).trim() : null,
        seq_no: r["SeqNo"] != null ? Number(r["SeqNo"]) : null,
        is_final_step: String(r["IsFinalStep"] || "").toLowerCase() === "yes",
      };
    }
    return {
      step_id: String(r["StepID"]).trim(),
      sku: sku,
      step_name: r["StepName"] ? String(r["StepName"]).trim() : null,
      seq_no: r["SeqNo"] != null ? Number(r["SeqNo"]) : null,
      is_final_step: String(r["IsFinalStep"] || "").toLowerCase() === "yes",
    };
  });

  if (nulledSkus > 0) console.log(`  ⚠️  ${nulledSkus} satırda SKU null yapıldı`);

  const inserted = await batchUpsert("assembly_steps", steps, "step_id");
  console.log(`  ✅ ${inserted} montaj adımı eklendi (${uniqueRows.length} unique / ${rows.length} total)`);
  return inserted;
}

// ─── STEP_BOM (1651 rows, DAG) ──────────────────────────────
async function seedStepBom() {
  console.log("\n📋 StepBOM seed başlatılıyor...");

  const wb = XLSX.readFile(EXCEL_PATH);
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["StepBOM"]);

  // Deduplicate by StepBOMID — keep first occurrence
  const seen = new Set<string>();
  let asmRefCount = 0;

  const stepBom = rows
    .filter((r) => {
      const id = String(r["StepBOMID"] || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => {
      const partId = String(r["PartID"] || "").trim();
      if (partId.startsWith("ASM-")) asmRefCount++;

      return {
        step_bom_id: String(r["StepBOMID"]).trim(),
        step_id: String(r["StepID"] || "").trim(),
        part_id: partId,
        qty_per: r["QtyPer"] != null ? Number(r["QtyPer"]) : 1,
        kodu: r["KODU"] ? String(r["KODU"]).trim() : null,
        kritik_stok_products: r["KritikStokProducts"] != null ? Number(r["KritikStokProducts"]) : 0,
      };
    });

  const dupes = rows.length - stepBom.length;
  if (dupes > 0) console.log(`  ⚠️  ${dupes} duplicate StepBOMID atlandı`);
  console.log(`  📊 ${asmRefCount} ASM referansı (DAG bağlantısı) tespit edildi`);

  const inserted = await batchUpsert("step_bom", stepBom, "step_bom_id");
  console.log(`  ✅ ${inserted} BOM satırı eklendi`);
  return inserted;
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Katman 4 — İlişkili tablolar seed başlatılıyor...\n");

  // Fetch existing reference data from Supabase
  console.log("📡 Mevcut referans verileri çekiliyor...");
  const existingSkus = await fetchExistingSkus();
  const existingPartIds = await fetchExistingPartIds();
  const existingMakine = await fetchExistingMakineIds();
  console.log(`   Products: ${existingSkus.size} SKU`);
  console.log(`   AllParts: ${existingPartIds.size} part`);
  console.log(`   KesimMakinesi: ${existingMakine.size} makine`);

  // Order matters: plakalar before plaka_parts, assembly_steps before step_bom
  const plakaCount = await seedPlakalar(existingSkus, existingMakine);
  const ppartCount = await seedPlakaParts(existingPartIds, existingSkus);
  const stepCount = await seedAssemblySteps(existingSkus);
  const bomCount = await seedStepBom();

  console.log("\n📊 Sonuç:");
  console.log(`   Plakalar:       ${plakaCount}`);
  console.log(`   PlakaParts:     ${ppartCount}`);
  console.log(`   AssemblySteps:  ${stepCount}`);
  console.log(`   StepBOM:        ${bomCount}`);
}

main().catch(console.error);
