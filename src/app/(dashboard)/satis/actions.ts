"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SATIS_ACCESS_ROLES, isExportChannel, isServiceSku } from "@/lib/constants";
import * as XLSX from "xlsx";

type ActionResult = { success: true; data?: unknown } | { success: false; error: string };

async function requireSalesAccess() {
  const user = await getCurrentUser();
  if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── EXCEL UPLOAD ───────────────────────────────────────────────

interface ParsedRow {
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
}

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  }
  const str = String(val).trim();
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
  }
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.split("T")[0];
  return null;
}

function parseNumber(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim().replace(/[^\d.,-]/g, "");
  if (!str) return 0;
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(str.replace(/,/g, "")) || 0;
  }
  if (str.includes(",")) {
    return parseFloat(str.replace(",", ".")) || 0;
  }
  return parseFloat(str) || 0;
}

function findHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v).toLowerCase().includes("tarih")) {
        return r;
      }
    }
  }
  return 0;
}

function parseExcelRows(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Excel dosyasında sayfa bulunamadı");

  const headerRow = findHeaderRow(sheet);
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRow,
    defval: "",
  });

  const rows: ParsedRow[] = [];

  for (const row of raw) {
    const keys = Object.keys(row);
    const findCol = (patterns: string[]) => {
      const key = keys.find((k) => {
        const lower = k.toLowerCase().trim();
        return patterns.some((p) => lower.includes(p));
      });
      return key ? row[key] : undefined;
    };

    const tarihVal = findCol(["tarih"]);
    const satisElemani = findCol(["satış elemanı", "satis elemani", "satiş elemani"]);
    const faturaNo = findCol(["fatura no", "fatura_no"]);
    const unvan = findCol(["unvan", "ünvan"]);
    const skuVal = findCol(["stok-hizmet kodu", "stok kodu", "stok hizmet"]);
    const miktarVal = findCol(["miktar"]);
    const birimFiyatVal = findCol(["birim fiyat", "birim_fiyat"]);
    const toplamTutarVal = findCol(["toplam tutar", "toplam_tutar"]);
    const kdvVal = findCol(["kdv %", "kdv"]);
    const dovizVal = findCol(["satır dövizi", "satir dovizi", "döviz", "doviz"]);

    const sku = skuVal ? String(skuVal).trim() : null;
    const miktar = parseNumber(miktarVal);

    if (!sku || miktar === 0) continue;
    const firstVal = String(Object.values(row)[0] || "");
    if (firstVal.includes("Listelenen:") || firstVal.includes("Toplam:")) continue;

    rows.push({
      tarih: parseExcelDate(tarihVal),
      satis_kanali: satisElemani ? String(satisElemani).trim().toUpperCase() : null,
      fatura_no: faturaNo ? String(faturaNo).trim() : null,
      musteri_adi: unvan ? String(unvan).trim() : null,
      sku,
      miktar: Math.round(miktar),
      birim_fiyat: parseNumber(birimFiyatVal),
      toplam_tutar: parseNumber(toplamTutarVal),
      kdv_orani: kdvVal != null && kdvVal !== "" ? parseNumber(kdvVal) : null,
      doviz: dovizVal ? String(dovizVal).trim() : "TL",
      is_hizmet: isServiceSku(sku),
    });
  }

  return rows;
}

/** Mükerrer fatura kontrolü */
export async function checkDuplicateInvoices(
  faturaNumbers: string[],
): Promise<{
  hasDuplicates: boolean;
  duplicates: { fatura_no: string; rapor_id: string }[];
}> {
  if (faturaNumbers.length === 0)
    return { hasDuplicates: false, duplicates: [] };

  const supabase = await createClient();
  const uniqueNos = [...new Set(faturaNumbers.filter(Boolean))];

  const allDups: { fatura_no: string; rapor_id: string }[] = [];
  for (let i = 0; i < uniqueNos.length; i += 200) {
    const batch = uniqueNos.slice(i, i + 200);
    const { data } = await supabase
      .from("satis_satirlari")
      .select("fatura_no, rapor_id")
      .in("fatura_no", batch);
    if (data) {
      const seen = new Set<string>();
      for (const d of data) {
        if (d.fatura_no && !seen.has(d.fatura_no)) {
          seen.add(d.fatura_no);
          allDups.push({
            fatura_no: d.fatura_no,
            rapor_id: d.rapor_id,
          });
        }
      }
    }
  }

  return { hasDuplicates: allDups.length > 0, duplicates: allDups };
}

/** Upload Excel + parse + create report + stock deduction */
export async function uploadSalesExcel(
  formData: FormData,
): Promise<
  | { success: true; raporId: string; satirSayisi: number }
  | {
      success: false;
      error: string;
      duplicates?: { fatura_no: string; rapor_id: string }[];
    }
> {
  try {
    const user = await requireSalesAccess();
    const supabase = await createClient();

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "Dosya seçilmedi" };

    const raporTarihiStr = formData.get("rapor_tarihi") as string | null;
    const forceOverwrite = formData.get("force_overwrite") === "true";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rows: ParsedRow[];
    try {
      rows = parseExcelRows(buffer);
    } catch (e) {
      return {
        success: false,
        error: `Excel parse hatası: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`,
      };
    }

    if (rows.length === 0) {
      return {
        success: false,
        error: "Excel dosyasında geçerli satır bulunamadı",
      };
    }

    // Mükerrer kontrol
    const faturaNumbers = rows
      .map((r) => r.fatura_no)
      .filter(Boolean) as string[];
    if (!forceOverwrite && faturaNumbers.length > 0) {
      const dupCheck = await checkDuplicateInvoices(faturaNumbers);
      if (dupCheck.hasDuplicates) {
        return {
          success: false,
          error: `${dupCheck.duplicates.length} mükerrer fatura bulundu`,
          duplicates: dupCheck.duplicates,
        };
      }
    }

    // If force overwrite, delete old report(s)
    if (forceOverwrite) {
      const oldRaporIds = [
        ...new Set(
          (await checkDuplicateInvoices(faturaNumbers)).duplicates.map(
            (d) => d.rapor_id,
          ),
        ),
      ];
      for (const oldId of oldRaporIds) {
        await deleteReport(oldId);
      }
    }

    // Generate rapor_id
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const raporId = `SAT-${datePart}-${timePart}`;

    let raporTarihi: string;
    if (raporTarihiStr) {
      raporTarihi = raporTarihiStr;
    } else {
      raporTarihi = rows[0]?.tarih || now.toISOString().split("T")[0];
    }

    // Totals
    const toplamSatir = rows.length;
    const toplamAdet = rows
      .filter((r) => !r.is_hizmet)
      .reduce((s, r) => s + r.miktar, 0);
    const toplamTutar = rows.reduce((s, r) => s + r.toplam_tutar, 0);
    const trTutar = rows
      .filter(
        (r) => !r.satis_kanali || !isExportChannel(r.satis_kanali),
      )
      .reduce((s, r) => s + r.toplam_tutar, 0);
    const ihracatTutar = rows
      .filter(
        (r) => r.satis_kanali && isExportChannel(r.satis_kanali),
      )
      .reduce((s, r) => s + r.toplam_tutar, 0);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    // INSERT satis_raporlari
    const { error: raporError } = await supabase
      .from("satis_raporlari")
      .insert({
        rapor_id: raporId,
        rapor_tarihi: raporTarihi,
        yukleyen_id: authUser?.id || null,
        yukleyen_adi: user.full_name,
        dosya_adi: file.name,
        toplam_satir: toplamSatir,
        toplam_adet: toplamAdet,
        toplam_tutar: toplamTutar,
        tr_tutar: trTutar,
        ihracat_tutar: ihracatTutar,
        durum: "aktif",
      });

    if (raporError) {
      return {
        success: false,
        error: `Rapor oluşturma hatası: ${raporError.message}`,
      };
    }

    // INSERT satis_satirlari (batch 200)
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map((r) => ({
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

      const { error: satirError } = await supabase
        .from("satis_satirlari")
        .insert(batch);

      if (satirError) {
        await supabase
          .from("satis_raporlari")
          .delete()
          .eq("rapor_id", raporId);
        return {
          success: false,
          error: `Satır ekleme hatası: ${satirError.message}`,
        };
      }
    }

    // STOK DÜŞÜMÜ
    const productRows = rows.filter((r) => !r.is_hizmet && r.sku);
    if (productRows.length > 0) {
      const skuTotals = new Map<string, number>();
      for (const r of productRows) {
        const current = skuTotals.get(r.sku!) || 0;
        skuTotals.set(r.sku!, current + r.miktar);
      }

      const movements = Array.from(skuTotals.entries()).map(
        ([sku, total]) => ({
          sku,
          qty: -total,
          source: "Satis",
          source_row_id: raporId,
          batch_id: raporId,
          tarih: raporTarihi,
        }),
      );

      for (let i = 0; i < movements.length; i += 200) {
        const batch = movements.slice(i, i + 200);
        await supabase.from("stock_movements").insert(batch);
      }

      for (const [sku, total] of skuTotals) {
        const { data: product } = await supabase
          .from("products")
          .select("stok_aktif")
          .eq("sku", sku)
          .single();
        if (product) {
          await supabase
            .from("products")
            .update({
              stok_aktif: ((product as { stok_aktif: number }).stok_aktif || 0) - total,
            })
            .eq("sku", sku);
        }
      }
    }

    revalidatePath("/satis");
    revalidatePath("/satis/raporlar");
    revalidatePath("/stok/mamul");

    return { success: true, raporId, satirSayisi: toplamSatir };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

/** Rapor silme + stok geri yükleme */
export async function deleteReport(
  raporId: string,
): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const supabase = await createClient();

    const { data: movements } = await supabase
      .from("stock_movements")
      .select("sku, qty")
      .eq("batch_id", raporId)
      .eq("source", "Satis");

    if (movements && movements.length > 0) {
      for (const m of movements as { sku: string | null; qty: number }[]) {
        if (m.sku) {
          const restoreQty = Math.abs(m.qty);
          const { data: product } = await supabase
            .from("products")
            .select("stok_aktif")
            .eq("sku", m.sku)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({
                stok_aktif: ((product as { stok_aktif: number }).stok_aktif || 0) + restoreQty,
              })
              .eq("sku", m.sku);
          }
        }
      }

      await supabase
        .from("stock_movements")
        .delete()
        .eq("batch_id", raporId)
        .eq("source", "Satis");
    }

    const { error } = await supabase
      .from("satis_raporlari")
      .delete()
      .eq("rapor_id", raporId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis");
    revalidatePath("/satis/raporlar");
    revalidatePath("/stok/mamul");

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

// ─── TYPES ──────────────────────────────────────────────────────

export type PeriodType = "today" | "week" | "month" | "all";
