/**
 * VigoWood — Seed: Base Tables (Katman 3)
 *
 * Imports products (101) and all_parts (379) from Excel to Supabase.
 * kesim_makinesi (3) is already seeded in the migration.
 *
 * Usage:
 *   npx tsx supabase/seed-base-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import XLSX from "xlsx";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Run from project root: npx tsx supabase/seed-base-tables.ts");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Excel serial date → ISO date string
function excelDateToISO(serial: number | undefined): string | null {
  if (!serial || typeof serial !== "number") return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 86400000);
  return date.toISOString().split("T")[0];
}

async function seedProducts() {
  console.log("\n📦 Products seed başlatılıyor...");

  const wb = XLSX.readFile(resolve(process.cwd(), "..", "data", "VIGO WOOD APP DATA.xlsx"));
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["Products"]);

  const products = rows.map((r) => ({
    sku: r["SKU"],
    kategori: r["Kategori"] || null,
    urun_adi: r["ÜrünAdı"] || null,
    aktif_mi: r["AktifMi"] === true,
    stok_aktif: r["StokAktif"] ?? 0,
    toplam_satis: r["ToplamSatış"] ?? 0,
    ilk_satis_tarihi: excelDateToISO(r["İlkSatısTarihi"]),
    satilan_gun_sayisi: r["SatılanGünSayısı"] ?? 0,
    gunluk_satis: r["GünlükSatış"] ?? 0,
    gecen_ay_uretim: r["GeçenAyÜretim"] ?? 0,
    aylik_uretim: r["AylıkÜretim"] ?? 0,
  }));

  const { error } = await supabase.from("products").upsert(products, { onConflict: "sku" });

  if (error) {
    console.error("  ❌ Products error:", error.message);
    return 0;
  }

  console.log(`  ✅ ${products.length} ürün eklendi`);
  return products.length;
}

async function seedAllParts() {
  console.log("\n🔩 AllParts seed başlatılıyor...");

  const wb = XLSX.readFile(resolve(process.cwd(), "..", "data", "VIGO WOOD APP DATA.xlsx"));
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets["AllParts"]);

  // Deduplicate by PartID — keep first occurrence
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    if (seen.has(r["PartID"])) return false;
    seen.add(r["PartID"]);
    return true;
  });

  const skipped = rows.length - uniqueRows.length;
  if (skipped > 0) {
    console.log(`  ⚠️  ${skipped} duplicate PartID atlandı`);
  }

  const parts = uniqueRows.map((r) => ({
    part_id: r["PartID"],
    part_adi: r["PartAdı"],
    part_type: r["PartType"],
    hazir_eleman_aktif_stok: r["HazırElemanAktifStok"] ?? 0,
    hazir_eleman_kritik_stok: r["HazırElemanKritikStok"] ?? 0,
    yari_mamul_stok: r["YarıMamulStok"] ?? 0,
  }));

  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < parts.length; i += BATCH_SIZE) {
    const batch = parts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("all_parts").upsert(batch, { onConflict: "part_id" });

    if (error) {
      console.error(`  ❌ AllParts batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted} parça eklendi (${parts.length} unique / ${rows.length} total)`);
  return inserted;
}

async function main() {
  console.log("🌱 Katman 3 — Temel tablolar seed başlatılıyor...\n");

  const prodCount = await seedProducts();
  const partsCount = await seedAllParts();

  console.log("\n📊 Sonuç:");
  console.log(`   Products: ${prodCount}`);
  console.log(`   AllParts: ${partsCount}`);
  console.log(`   KesimMakinesi: 3 (migration'da eklendi)`);
}

main().catch(console.error);
