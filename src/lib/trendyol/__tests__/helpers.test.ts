/**
 * Tests for Trendyol helper functions
 * - aggregateSettlements (financial aggregation)
 * - formatTRY (currency formatting)
 * - date helpers
 * - status labels/colors
 */
import { describe, it, expect } from "vitest";
import type { TrendyolSettlement, TrendyolOrder } from "../types";
import {
  aggregateSettlements,
  formatTRY,
  formatTrendyolDate,
  formatTrendyolDateShort,
  daysAgoTimestamp,
  endOfTodayTimestamp,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_COLORS,
  calculateOrderTotal,
  getCustomerName,
  getOrderProductSummary,
  getOrderTotalQuantity,
} from "../helpers";

// ─── aggregateSettlements ─────────────────────────────────

describe("aggregateSettlements", () => {
  it("returns zeroes for empty array", () => {
    const result = aggregateSettlements([]);
    expect(result).toEqual({
      totalSales: 0,
      totalReturns: 0,
      totalCommission: 0,
      totalDiscount: 0,
      netAmount: 0,
    });
  });

  it("aggregates Sale entries with per-row commission data", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10T10:00:00.000Z",
        transactionType: "Sale",
        credit: 484,
        debt: 0,
        commissionRate: 12.5,
        commissionAmount: 60.5,
        sellerRevenue: 423.5,
      },
      {
        id: 2,
        transactionDate: "2026-02-10T11:00:00.000Z",
        transactionType: "Sale",
        credit: 593,
        debt: 0,
        commissionRate: 11.4,
        commissionAmount: 67.6,
        sellerRevenue: 525.4,
      },
    ];

    const result = aggregateSettlements(settlements);

    expect(result.totalSales).toBe(484 + 593);
    expect(result.totalCommission).toBe(60.5 + 67.6);
    expect(result.totalReturns).toBe(0);
    expect(result.totalDiscount).toBe(0);
    // netAmount = totalSellerRevenue - totalReturns = (423.5 + 525.4) - 0
    expect(result.netAmount).toBe(423.5 + 525.4);
  });

  it("handles Sale entries without per-row commission (fallback)", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10T10:00:00.000Z",
        transactionType: "Sale",
        credit: 1000,
        debt: 0,
        // No commissionAmount or sellerRevenue
      },
    ];

    const result = aggregateSettlements(settlements);

    expect(result.totalSales).toBe(1000);
    expect(result.totalCommission).toBe(0);
    // No sellerRevenue, so fallback: totalSales - totalReturns - totalCommission - totalDiscount
    expect(result.netAmount).toBe(1000);
  });

  it("handles Return entries correctly", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10T10:00:00.000Z",
        transactionType: "Sale",
        credit: 1000,
        debt: 0,
        commissionAmount: 100,
        sellerRevenue: 900,
      },
      {
        id: 2,
        transactionDate: "2026-02-11T10:00:00.000Z",
        transactionType: "Return",
        credit: 0,
        debt: 300,
      },
    ];

    const result = aggregateSettlements(settlements);

    expect(result.totalSales).toBe(1000);
    expect(result.totalReturns).toBe(300);
    expect(result.totalCommission).toBe(100);
    // netAmount = sellerRevenue - returns = 900 - 300
    expect(result.netAmount).toBe(600);
  });

  it("handles Discount entries", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10",
        transactionType: "Sale",
        credit: 500,
        debt: 0,
      },
      {
        id: 2,
        transactionDate: "2026-02-10",
        transactionType: "Discount",
        credit: 0,
        debt: 50,
      },
      {
        id: 3,
        transactionDate: "2026-02-10",
        transactionType: "TYDiscount",
        credit: 0,
        debt: 30,
      },
    ];

    const result = aggregateSettlements(settlements);

    expect(result.totalSales).toBe(500);
    expect(result.totalDiscount).toBe(80); // 50 + 30
    // Fallback: 500 - 0 - 0 - 80 = 420
    expect(result.netAmount).toBe(420);
  });

  it("handles CommissionPositive/Negative entries", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10",
        transactionType: "Sale",
        credit: 1000,
        debt: 0,
      },
      {
        id: 2,
        transactionDate: "2026-02-10",
        transactionType: "CommissionNegative",
        credit: 0,
        debt: 120,
      },
    ];

    const result = aggregateSettlements(settlements);

    expect(result.totalCommission).toBe(120); // debt - credit = 120 - 0
    // Fallback: 1000 - 0 - 120 - 0 = 880
    expect(result.netAmount).toBe(880);
  });

  it("handles mixed real-world scenario", () => {
    // Simulating actual Trendyol data pattern (all Satış with per-row commission)
    const settlements: TrendyolSettlement[] = [];
    for (let i = 0; i < 100; i++) {
      const credit = 400 + Math.floor(i * 5);
      const commissionRate = 12.5;
      const commissionAmount = credit * commissionRate / 100;
      settlements.push({
        id: i,
        transactionDate: `2026-02-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00.000Z`,
        transactionType: "Sale",
        credit,
        debt: 0,
        commissionRate,
        commissionAmount,
        sellerRevenue: credit - commissionAmount,
      });
    }

    const result = aggregateSettlements(settlements);

    expect(result.totalSales).toBeGreaterThan(0);
    expect(result.totalCommission).toBeGreaterThan(0);
    expect(result.netAmount).toBeGreaterThan(0);
    // Net should be less than sales (commission was deducted)
    expect(result.netAmount).toBeLessThan(result.totalSales);
    // Commission should be ~12.5% of sales
    const commissionPercent = (result.totalCommission / result.totalSales) * 100;
    expect(commissionPercent).toBeCloseTo(12.5, 0);
  });

  it("handles undefined credit/debt gracefully", () => {
    const settlements: TrendyolSettlement[] = [
      {
        id: 1,
        transactionDate: "2026-02-10",
        transactionType: "Sale",
        // credit and debt are optional/undefined
      },
    ];

    const result = aggregateSettlements(settlements);
    expect(result.totalSales).toBe(0);
    expect(result.netAmount).toBe(0);
  });
});

// ─── formatTRY ───────────────────────────────────────────

describe("formatTRY", () => {
  it("formats basic amounts", () => {
    const result = formatTRY(1234.56);
    expect(result).toContain("1.234");
    expect(result).toContain("56");
  });

  it("formats zero", () => {
    const result = formatTRY(0);
    expect(result).toContain("0");
  });

  it("formats large amounts", () => {
    const result = formatTRY(123456.78);
    expect(result).toContain("123.456");
  });

  it("formats negative amounts", () => {
    const result = formatTRY(-500);
    expect(result).toContain("500");
  });
});

// ─── Date Helpers ────────────────────────────────────────

describe("formatTrendyolDate", () => {
  it("formats timestamp to DD.MM.YYYY HH:mm", () => {
    // 2026-01-15 10:30:00 UTC → depends on local timezone
    const ts = new Date("2026-01-15T10:30:00Z").getTime();
    const result = formatTrendyolDate(ts);
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/);
    expect(result).toContain("2026");
  });
});

describe("formatTrendyolDateShort", () => {
  it("formats timestamp to DD.MM.YYYY", () => {
    const ts = new Date("2026-02-20T15:00:00Z").getTime();
    const result = formatTrendyolDateShort(ts);
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(result).toContain("2026");
  });
});

describe("daysAgoTimestamp", () => {
  it("returns a timestamp from N days ago", () => {
    const now = Date.now();
    const thirtyDaysAgo = daysAgoTimestamp(30);
    const diff = now - thirtyDaysAgo;
    // Should be approximately 30 days (within 1 day tolerance due to rounding)
    expect(diff).toBeGreaterThan(29 * 86_400_000);
    expect(diff).toBeLessThan(31 * 86_400_000);
  });

  it("returns start of day", () => {
    const ts = daysAgoTimestamp(0);
    const d = new Date(ts);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe("endOfTodayTimestamp", () => {
  it("returns end of today", () => {
    const ts = endOfTodayTimestamp();
    const d = new Date(ts);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });
});

// ─── Status Labels ───────────────────────────────────────

describe("ORDER_STATUS_LABELS", () => {
  it("has labels for all statuses", () => {
    const statuses = ["Created", "Picking", "Invoiced", "Shipped", "Delivered", "Cancelled", "Returned"];
    for (const status of statuses) {
      expect(ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]).toBeTruthy();
    }
  });
});

describe("ORDER_STATUS_COLORS", () => {
  it("has bg and text for each status", () => {
    for (const [, colors] of Object.entries(ORDER_STATUS_COLORS)) {
      expect(colors.bg).toMatch(/^bg-/);
      expect(colors.text).toMatch(/^text-/);
    }
  });
});

describe("QUESTION_STATUS_LABELS", () => {
  it("has label for WAITING_FOR_ANSWER", () => {
    expect(QUESTION_STATUS_LABELS.WAITING_FOR_ANSWER).toBeTruthy();
  });
});

describe("QUESTION_STATUS_COLORS", () => {
  it("has colors for each status", () => {
    for (const [, colors] of Object.entries(QUESTION_STATUS_COLORS)) {
      expect(colors.bg).toMatch(/^bg-/);
      expect(colors.text).toMatch(/^text-/);
    }
  });
});

// ─── Order Helpers ───────────────────────────────────────

describe("getCustomerName", () => {
  it("returns full name", () => {
    const order = { customerFirstName: "Ali", customerLastName: "Yılmaz" } as TrendyolOrder;
    expect(getCustomerName(order)).toBe("Ali Yılmaz");
  });

  it("handles empty names", () => {
    const order = { customerFirstName: "", customerLastName: "" } as TrendyolOrder;
    expect(getCustomerName(order)).toBe("");
  });
});

describe("getOrderProductSummary", () => {
  it("returns dash for no lines", () => {
    const order = { lines: [] } as unknown as TrendyolOrder;
    expect(getOrderProductSummary(order)).toBe("-");
  });

  it("returns product name for single line", () => {
    const order = {
      lines: [{ productName: "Masa" }],
    } as unknown as TrendyolOrder;
    expect(getOrderProductSummary(order)).toBe("Masa");
  });

  it("returns summary for multiple lines", () => {
    const order = {
      lines: [{ productName: "Masa" }, { productName: "Sandalye" }, { productName: "Raf" }],
    } as unknown as TrendyolOrder;
    expect(getOrderProductSummary(order)).toBe("Masa +2 ürün");
  });
});

describe("getOrderTotalQuantity", () => {
  it("sums quantities from all lines", () => {
    const order = {
      lines: [{ quantity: 2 }, { quantity: 3 }, { quantity: 1 }],
    } as unknown as TrendyolOrder;
    expect(getOrderTotalQuantity(order)).toBe(6);
  });
});

describe("calculateOrderTotal", () => {
  it("sums amounts from lines", () => {
    const order = {
      lines: [{ amount: 100 }, { amount: 200.5 }],
    } as unknown as TrendyolOrder;
    expect(calculateOrderTotal(order)).toBe(300.5);
  });
});
