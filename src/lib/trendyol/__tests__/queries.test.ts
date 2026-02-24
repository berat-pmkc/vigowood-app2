/**
 * Tests for Trendyol query layer — mapper functions and normalization
 * Tests the pure functions extracted from queries.ts (no DB dependency)
 */
import { describe, it, expect } from "vitest";
import { aggregateSettlements } from "../helpers";

// ─── TR→EN Type Mapping ─────────────────────────────────
// Re-define the mapping here since it's not exported from queries.ts (server-only)
const TR_TO_EN_TYPE: Record<string, string> = {
  "Satış": "Sale",
  "İade": "Return",
  "İndirim": "Discount",
  "İndirimİptal": "DiscountCancel",
  "Kupon": "Coupon",
  "KuponİIptal": "CouponCancel",
  "KomisyonArtı": "CommissionPositive",
  "KomisyonEksi": "CommissionNegative",
  "TYİndirim": "TYDiscount",
  "TYİndirimİptal": "TYDiscountCancel",
  "SatıcıGelirArtı": "SellerRevenuePositive",
  "SatıcıGelirEksi": "SellerRevenueNegative",
};

/** Convert timestamp string (ms) to ISO date string — same as queries.ts */
function tsToISO(ts: string | null): string {
  if (!ts) return "";
  // If it looks like an ISO date (contains '-' or 'T'), return as-is
  if (ts.includes("-") || ts.includes("T")) return ts;
  const n = parseInt(ts, 10);
  if (isNaN(n)) return ts;
  return new Date(n).toISOString();
}

describe("TR_TO_EN_TYPE mapping", () => {
  it("maps Turkish 'Satış' to English 'Sale'", () => {
    expect(TR_TO_EN_TYPE["Satış"]).toBe("Sale");
  });

  it("maps Turkish 'İade' to English 'Return'", () => {
    expect(TR_TO_EN_TYPE["İade"]).toBe("Return");
  });

  it("maps all discount types", () => {
    expect(TR_TO_EN_TYPE["İndirim"]).toBe("Discount");
    expect(TR_TO_EN_TYPE["İndirimİptal"]).toBe("DiscountCancel");
    expect(TR_TO_EN_TYPE["TYİndirim"]).toBe("TYDiscount");
    expect(TR_TO_EN_TYPE["TYİndirimİptal"]).toBe("TYDiscountCancel");
  });

  it("maps commission types", () => {
    expect(TR_TO_EN_TYPE["KomisyonArtı"]).toBe("CommissionPositive");
    expect(TR_TO_EN_TYPE["KomisyonEksi"]).toBe("CommissionNegative");
  });

  it("maps coupon types", () => {
    expect(TR_TO_EN_TYPE["Kupon"]).toBe("Coupon");
    expect(TR_TO_EN_TYPE["KuponİIptal"]).toBe("CouponCancel");
  });

  it("maps seller revenue types", () => {
    expect(TR_TO_EN_TYPE["SatıcıGelirArtı"]).toBe("SellerRevenuePositive");
    expect(TR_TO_EN_TYPE["SatıcıGelirEksi"]).toBe("SellerRevenueNegative");
  });

  it("returns undefined for unknown types (fallback to original)", () => {
    const unknown = TR_TO_EN_TYPE["BilinmeyenTür"];
    expect(unknown).toBeUndefined();
    // In queries.ts: TR_TO_EN_TYPE[row.transaction_type] || row.transaction_type
    // So unknown types pass through unchanged
    const normalized = TR_TO_EN_TYPE["BilinmeyenTür"] || "BilinmeyenTür";
    expect(normalized).toBe("BilinmeyenTür");
  });

  it("handles already-English types (passthrough)", () => {
    // If API returns English directly, it should pass through
    const type = "Sale";
    const normalized = TR_TO_EN_TYPE[type] || type;
    expect(normalized).toBe("Sale"); // It maps Sale → Sale via lookup, perfect
  });
});

describe("tsToISO", () => {
  it("converts valid ms timestamp string to ISO", () => {
    const ts = "1770632955335";
    const result = tsToISO(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Verify it's a valid date
    const d = new Date(result);
    expect(d.getTime()).not.toBeNaN();
    expect(d.getFullYear()).toBe(2026);
  });

  it("returns empty string for null", () => {
    expect(tsToISO(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(tsToISO("")).toBe("");
  });

  it("returns original string if already ISO format", () => {
    const iso = "2026-02-10T10:30:00.000Z";
    expect(tsToISO(iso)).toBe(iso);
  });

  it("handles edge case: NaN-producing string", () => {
    const result = tsToISO("not-a-number");
    // parseInt("not-a-number") → NaN → returns original string
    expect(result).toBe("not-a-number");
  });

  it("converts oldest settlement timestamp correctly", () => {
    const ts = "1769358872250";
    const result = tsToISO(ts);
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January (0-indexed)
  });

  it("converts newest settlement timestamp correctly", () => {
    const ts = "1771928937417";
    const result = tsToISO(ts);
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // February (0-indexed)
  });

  it("ISO output supports substring(0,7) for monthly grouping", () => {
    const ts = "1770632955335";
    const iso = tsToISO(ts);
    const monthKey = iso.substring(0, 7);
    expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(monthKey).toBe("2026-02");
  });
});

// ─── Settlement Row Mapping ──────────────────────────────
// Simulate the mapSettlementRow logic from queries.ts

interface SettlementRow {
  id: number;
  transaction_date: string | null;
  transaction_type: string;
  debt: number;
  credit: number;
  receipt_id: string | null;
  barcode: string | null;
  payment_order_id: string | null;
  payment_date: string | null;
  commission_rate: number | null;
  commission_amount: number | null;
  seller_revenue: number | null;
  order_number: string | null;
  affiliate: string | null;
  shipment_package_id: number | null;
}

function mapSettlementRow(row: SettlementRow) {
  const enType = TR_TO_EN_TYPE[row.transaction_type] || row.transaction_type;
  const txDate = tsToISO(row.transaction_date);
  const pmtDate = tsToISO(row.payment_date);

  return {
    id: row.id,
    transactionDate: txDate,
    transactionType: enType,
    debt: row.debt,
    credit: row.credit,
    receiptId: row.receipt_id ?? undefined,
    barcode: row.barcode ?? undefined,
    paymentOrderId: row.payment_order_id ?? undefined,
    paymentDate: pmtDate || undefined,
    commissionRate: row.commission_rate ?? undefined,
    commissionAmount: row.commission_amount ?? undefined,
    sellerRevenue: row.seller_revenue ?? undefined,
    orderNumber: row.order_number ?? undefined,
    affiliate: row.affiliate ?? undefined,
    shipmentPackageId: row.shipment_package_id ?? undefined,
  };
}

describe("mapSettlementRow", () => {
  it("maps a real Trendyol settlement row correctly", () => {
    const row: SettlementRow = {
      id: 12945278974,
      transaction_date: "1770632955335",
      transaction_type: "Satış",
      credit: 484,
      debt: 0,
      receipt_id: null,
      barcode: "VW-MASA-001",
      payment_order_id: null,
      payment_date: null,
      commission_rate: 12.5,
      commission_amount: 60.5,
      seller_revenue: 423.5,
      order_number: "10944796297",
      affiliate: null,
      shipment_package_id: 3593837683,
    };

    const result = mapSettlementRow(row);

    expect(result.id).toBe(12945278974);
    expect(result.transactionType).toBe("Sale"); // Turkish→English normalized
    expect(result.transactionDate).toMatch(/^2026-02/); // ISO date string
    expect(result.credit).toBe(484);
    expect(result.debt).toBe(0);
    expect(result.commissionRate).toBe(12.5);
    expect(result.commissionAmount).toBe(60.5);
    expect(result.sellerRevenue).toBe(423.5);
    expect(result.barcode).toBe("VW-MASA-001");
    expect(result.orderNumber).toBe("10944796297");
  });

  it("handles null transaction_date", () => {
    const row: SettlementRow = {
      id: 1,
      transaction_date: null,
      transaction_type: "Satış",
      credit: 100,
      debt: 0,
      receipt_id: null,
      barcode: null,
      payment_order_id: null,
      payment_date: null,
      commission_rate: null,
      commission_amount: null,
      seller_revenue: null,
      order_number: null,
      affiliate: null,
      shipment_package_id: null,
    };

    const result = mapSettlementRow(row);
    expect(result.transactionDate).toBe("");
    expect(result.commissionAmount).toBeUndefined();
    expect(result.sellerRevenue).toBeUndefined();
  });

  it("passes through unknown transaction types", () => {
    const row: SettlementRow = {
      id: 1,
      transaction_date: "1770632955335",
      transaction_type: "UnknownType",
      credit: 0,
      debt: 50,
      receipt_id: null,
      barcode: null,
      payment_order_id: null,
      payment_date: null,
      commission_rate: null,
      commission_amount: null,
      seller_revenue: null,
      order_number: null,
      affiliate: null,
      shipment_package_id: null,
    };

    const result = mapSettlementRow(row);
    expect(result.transactionType).toBe("UnknownType");
  });
});

// ─── Date Filtering Logic ────────────────────────────────

describe("settlement date filtering", () => {
  it("timestamp string comparison works for 13-digit timestamps", () => {
    // This tests the DB-level filtering approach used in queries.ts
    // Supabase compares transaction_date as TEXT against String(startDate)
    const oldest = "1769358872250"; // 2026-01-25
    const newest = "1771928937417"; // 2026-02-24
    const thirtyDaysAgo = String(Date.now() - 30 * 86_400_000);

    // String comparison should work for same-length positive timestamps
    expect(oldest.length).toBe(13);
    expect(newest.length).toBe(13);
    expect(thirtyDaysAgo.length).toBe(13);

    // Lexicographic comparison works correctly for 13-digit timestamps
    expect(oldest < newest).toBe(true);
  });

  it("ISO date substring(0,7) works for monthly grouping", () => {
    const dates = [
      "1769358872250", // Jan 25
      "1770632955335", // Feb 10
      "1771928937417", // Feb 24
    ];

    const monthKeys = dates.map((ts) => tsToISO(ts).substring(0, 7));

    expect(monthKeys[0]).toBe("2026-01");
    expect(monthKeys[1]).toBe("2026-02");
    expect(monthKeys[2]).toBe("2026-02");
  });
});

// ─── End-to-End Flow Test ────────────────────────────────

describe("end-to-end: DB row → mapped settlement → aggregation", () => {
  it("processes realistic Trendyol data flow correctly", () => {
    // Step 1: Simulate DB rows (as they come from Supabase)
    const dbRows: SettlementRow[] = [
      {
        id: 1,
        transaction_date: "1770632955335",
        transaction_type: "Satış",
        credit: 484,
        debt: 0,
        receipt_id: null,
        barcode: "VW-001",
        payment_order_id: null,
        payment_date: null,
        commission_rate: 12.5,
        commission_amount: 60.5,
        seller_revenue: 423.5,
        order_number: "ORD-001",
        affiliate: null,
        shipment_package_id: 100,
      },
      {
        id: 2,
        transaction_date: "1770632937346",
        transaction_type: "Satış",
        credit: 593,
        debt: 0,
        receipt_id: null,
        barcode: "VW-002",
        payment_order_id: null,
        payment_date: null,
        commission_rate: 11.4,
        commission_amount: 67.6,
        seller_revenue: 525.4,
        order_number: "ORD-002",
        affiliate: null,
        shipment_package_id: 101,
      },
      {
        id: 3,
        transaction_date: "1770632931601",
        transaction_type: "Satış",
        credit: 899,
        debt: 0,
        receipt_id: null,
        barcode: "VW-003",
        payment_order_id: null,
        payment_date: null,
        commission_rate: 21,
        commission_amount: 188.79,
        seller_revenue: 710.21,
        order_number: "ORD-003",
        affiliate: null,
        shipment_package_id: 102,
      },
    ];

    // Step 2: Map rows (simulates queries.ts mapSettlementRow)
    const settlements = dbRows.map(mapSettlementRow);

    // Verify mapping
    expect(settlements).toHaveLength(3);
    expect(settlements[0].transactionType).toBe("Sale");
    expect(settlements[0].transactionDate).toMatch(/^2026-02/);
    expect(settlements[0].commissionAmount).toBe(60.5);

    // Step 3: Aggregate (simulates helpers.ts aggregateSettlements)
    const result = aggregateSettlements(settlements);

    // Verify aggregation
    expect(result.totalSales).toBe(484 + 593 + 899);
    expect(result.totalCommission).toBe(60.5 + 67.6 + 188.79);
    expect(result.totalReturns).toBe(0);
    expect(result.totalDiscount).toBe(0);
    // netAmount = totalSellerRevenue - totalReturns
    expect(result.netAmount).toBeCloseTo(423.5 + 525.4 + 710.21, 1);

    // Step 4: Verify monthly grouping works
    const monthlyMap = new Map<string, typeof settlements>();
    for (const s of settlements) {
      const month = s.transactionDate.substring(0, 7);
      if (!monthlyMap.has(month)) monthlyMap.set(month, []);
      monthlyMap.get(month)!.push(s);
    }
    // All 3 are from 2026-02
    expect(monthlyMap.size).toBe(1);
    expect(monthlyMap.has("2026-02")).toBe(true);
    expect(monthlyMap.get("2026-02")!).toHaveLength(3);
  });
});
