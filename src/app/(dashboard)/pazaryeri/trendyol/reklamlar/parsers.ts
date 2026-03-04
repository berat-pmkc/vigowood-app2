// ─── Turkish Number Parser ──────────────────────────────────
// Trendyol exports: "3.013,05" (dot=thousands, comma=decimal)
// Mock/other:       "3013.05"  (dot=decimal)
// Also handles:     "250", "0", "-"
export function parseTurkishNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "-" || raw === "") return 0;
  if (typeof raw === "number") return raw;

  const s = raw.trim();
  if (s === "-" || s === "") return 0;

  // Detect format: if both dot and comma exist → Turkish format
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // Turkish: "3.013,05" → remove dots, replace comma with dot
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  } else if (hasComma && !hasDot) {
    // Comma only: "2,08" → decimal comma
    return parseFloat(s.replace(",", ".")) || 0;
  } else {
    // Standard: "3013.05" or "250"
    return parseFloat(s) || 0;
  }
}

export function parseTurkishInt(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "-" || raw === "") return 0;
  if (typeof raw === "number") return Math.round(raw);
  const s = raw.trim();
  if (s === "-" || s === "") return 0;
  return Math.round(parseTurkishNumber(s));
}

// ─── Date Parser from Filename ──────────────────────────────
// "Ürün Reklamları Raporum - 04.03.2026-06.39.xlsx" → "2026-03-04"
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{2})[._](\d{2})[._](\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const day = parseInt(dd);
    const month = parseInt(mm);
    const year = parseInt(yyyy);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

// ─── Excel Row Parser ────────────────────────────────────────
export interface ParsedAdRow {
  ad_name: string;
  status: string;
  start_date: string;
  end_date: string;
  product_count: number;
  content_ids: string;
  total_budget: number | null;
  daily_budget: number;
  remaining_budget: number;
  spent: number;
  cpc_bid: string | null;
  actual_cpc: number;
  clicks: number;
  impressions: number;
  direct_sales: number;
  indirect_sales: number;
  total_sales: number;
  direct_revenue: number;
  indirect_revenue: number;
  total_revenue: number;
  cumulative_roas: number;
}

export function parseExcelRows(headers: string[], rows: string[][]): ParsedAdRow[] {
  const hasTbmTeklifi = headers.includes("TBM Teklifi");
  const result: ParsedAdRow[] = [];

  for (const row of rows) {
    if (!row[0] || row[0].trim() === "") continue;

    let idx = 0;
    const adName = String(row[idx++] || "").trim();
    const status = String(row[idx++] || "").trim();
    const startDate = String(row[idx++] || "").trim();
    const endDate = String(row[idx++] || "").trim();
    const productCount = parseTurkishInt(row[idx++]);
    const contentIds = String(row[idx++] || "").trim();
    const totalBudgetRaw = String(row[idx++] || "").trim();
    const totalBudget = totalBudgetRaw === "-" ? null : parseTurkishNumber(totalBudgetRaw);
    const dailyBudget = parseTurkishNumber(row[idx++]);
    const remainingBudget = parseTurkishNumber(row[idx++]);
    const spent = parseTurkishNumber(row[idx++]);

    let cpcBid: string | null = null;
    if (hasTbmTeklifi) {
      cpcBid = String(row[idx++] || "").trim() || null;
    }

    const actualCpc = parseTurkishNumber(row[idx++]);
    const clicks = parseTurkishInt(row[idx++]);
    const impressions = parseTurkishInt(row[idx++]);
    const directSales = parseTurkishInt(row[idx++]);
    const indirectSales = parseTurkishInt(row[idx++]);
    const totalSales = parseTurkishInt(row[idx++]);
    const directRevenue = parseTurkishNumber(row[idx++]);
    const indirectRevenue = parseTurkishNumber(row[idx++]);
    const totalRevenue = parseTurkishNumber(row[idx++]);
    const cumulativeRoas = parseTurkishNumber(row[idx++]);

    result.push({
      ad_name: adName,
      status,
      start_date: startDate,
      end_date: endDate,
      product_count: productCount,
      content_ids: contentIds,
      total_budget: totalBudget,
      daily_budget: dailyBudget,
      remaining_budget: remainingBudget,
      spent,
      cpc_bid: cpcBid,
      actual_cpc: actualCpc,
      clicks,
      impressions,
      direct_sales: directSales,
      indirect_sales: indirectSales,
      total_sales: totalSales,
      direct_revenue: directRevenue,
      indirect_revenue: indirectRevenue,
      total_revenue: totalRevenue,
      cumulative_roas: cumulativeRoas,
    });
  }

  return result;
}
