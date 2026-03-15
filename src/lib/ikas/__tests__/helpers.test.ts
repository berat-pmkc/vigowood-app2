import { describe, it, expect } from "vitest";
import {
  getCustomerSegment,
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORT_OPTIONS,
  type CustomerSegmentKey,
  type CustomerSegmentInput,
} from "../helpers";

// Fixed "now" for deterministic tests: 2026-03-15T12:00:00Z
const NOW = new Date("2026-03-15T12:00:00Z").getTime();

/** Helper to create a customer input with defaults */
function customer(overrides: Partial<CustomerSegmentInput> = {}): CustomerSegmentInput {
  return {
    orderCount: null,
    totalOrderPrice: null,
    firstOrderDate: null,
    lastOrderDate: null,
    ...overrides,
  };
}

/** Helper: months ago from NOW */
function monthsAgo(months: number): number {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

// ─── getCustomerSegment ────────────────────────────────
describe("getCustomerSegment", () => {
  // ── Potansiyel ──
  describe("Potansiyel segment", () => {
    it("returns Potansiyel for orderCount 0", () => {
      expect(getCustomerSegment(customer({ orderCount: 0 }), NOW).key).toBe("potansiyel");
    });

    it("returns Potansiyel for null orderCount", () => {
      expect(getCustomerSegment(customer(), NOW).key).toBe("potansiyel");
    });

    it("returns Potansiyel even with lastOrderDate (count is 0)", () => {
      expect(getCustomerSegment(customer({ orderCount: 0, lastOrderDate: monthsAgo(1) }), NOW).key).toBe("potansiyel");
    });
  });

  // ── Kayıp ──
  describe("Kayıp segment", () => {
    it("returns Kayıp for order > 12 months ago", () => {
      expect(getCustomerSegment(customer({
        orderCount: 5,
        lastOrderDate: monthsAgo(13),
      }), NOW).key).toBe("kayip");
    });

    it("returns Kayıp for high-value customer inactive > 12 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 15,
        totalOrderPrice: 50000,
        lastOrderDate: monthsAgo(14),
      }), NOW).key).toBe("kayip");
    });

    it("returns Kayıp for orders but null lastOrderDate", () => {
      expect(getCustomerSegment(customer({
        orderCount: 3,
        lastOrderDate: null,
      }), NOW).key).toBe("kayip");
    });

    it("returns Kayıp (fallback) for 1 order, 6-12 months ago, not new", () => {
      expect(getCustomerSegment(customer({
        orderCount: 1,
        firstOrderDate: monthsAgo(8),
        lastOrderDate: monthsAgo(8),
      }), NOW).key).toBe("kayip");
    });
  });

  // ── VIP ──
  describe("VIP segment", () => {
    it("returns VIP for 10+ orders in last 6 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 10,
        totalOrderPrice: 15000,
        firstOrderDate: monthsAgo(24),
        lastOrderDate: monthsAgo(1),
      }), NOW).key).toBe("vip");
    });

    it("returns VIP for 20K+ spend in last 6 months (even low count)", () => {
      expect(getCustomerSegment(customer({
        orderCount: 2,
        totalOrderPrice: 25000,
        firstOrderDate: monthsAgo(12),
        lastOrderDate: monthsAgo(2),
      }), NOW).key).toBe("vip");
    });

    it("returns VIP for high count AND high spend", () => {
      expect(getCustomerSegment(customer({
        orderCount: 15,
        totalOrderPrice: 50000,
        firstOrderDate: monthsAgo(24),
        lastOrderDate: monthsAgo(1),
      }), NOW).key).toBe("vip");
    });

    it("does NOT return VIP if last order > 6 months ago (becomes Sadık or Kayıp)", () => {
      const seg = getCustomerSegment(customer({
        orderCount: 12,
        totalOrderPrice: 30000,
        firstOrderDate: monthsAgo(24),
        lastOrderDate: monthsAgo(8),
      }), NOW);
      expect(seg.key).not.toBe("vip");
      expect(seg.key).toBe("sadik"); // 3+ orders, within 12 months
    });
  });

  // ── Yeni ──
  describe("Yeni segment", () => {
    it("returns Yeni for first order within 3 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 1,
        firstOrderDate: monthsAgo(1),
        lastOrderDate: monthsAgo(1),
      }), NOW).key).toBe("yeni");
    });

    it("returns Yeni for 2 orders, first order within 3 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 2,
        firstOrderDate: monthsAgo(2),
        lastOrderDate: monthsAgo(0),
      }), NOW).key).toBe("yeni");
    });

    it("does NOT return Yeni if first order > 3 months ago", () => {
      const seg = getCustomerSegment(customer({
        orderCount: 1,
        firstOrderDate: monthsAgo(5),
        lastOrderDate: monthsAgo(1),
      }), NOW);
      expect(seg.key).not.toBe("yeni");
      expect(seg.key).toBe("aktif"); // 1 order, last within 6 months
    });
  });

  // ── Sadık ──
  describe("Sadık segment", () => {
    it("returns Sadık for 3+ orders within 12 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 5,
        firstOrderDate: monthsAgo(18),
        lastOrderDate: monthsAgo(2),
      }), NOW).key).toBe("sadik");
    });

    it("returns Sadık for 9 orders within 12 months (not VIP — last order > 6m)", () => {
      expect(getCustomerSegment(customer({
        orderCount: 9,
        firstOrderDate: monthsAgo(24),
        lastOrderDate: monthsAgo(8),
      }), NOW).key).toBe("sadik");
    });

    it("does NOT return Sadık if last order > 12 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 5,
        firstOrderDate: monthsAgo(24),
        lastOrderDate: monthsAgo(18),
      }), NOW).key).toBe("kayip");
    });
  });

  // ── Aktif ──
  describe("Aktif segment", () => {
    it("returns Aktif for 1 order within 6 months", () => {
      expect(getCustomerSegment(customer({
        orderCount: 1,
        firstOrderDate: monthsAgo(5),
        lastOrderDate: monthsAgo(3),
      }), NOW).key).toBe("aktif");
    });

    it("returns Aktif for 2 orders within 6 months, first > 3 months ago", () => {
      expect(getCustomerSegment(customer({
        orderCount: 2,
        firstOrderDate: monthsAgo(10),
        lastOrderDate: monthsAgo(4),
      }), NOW).key).toBe("aktif");
    });

    it("does NOT return Aktif if last order > 6 months (but < 12m, count < 3)", () => {
      expect(getCustomerSegment(customer({
        orderCount: 1,
        firstOrderDate: monthsAgo(9),
        lastOrderDate: monthsAgo(9),
      }), NOW).key).toBe("kayip"); // fallback
    });
  });

  // ── Colors ──
  it("returns correct colors for each segment", () => {
    const vip = getCustomerSegment(customer({
      orderCount: 12, totalOrderPrice: 30000,
      firstOrderDate: monthsAgo(24), lastOrderDate: monthsAgo(1),
    }), NOW);
    expect(vip.bg).toBe("bg-amber-100");
    expect(vip.text).toBe("text-amber-800");

    const potansiyel = getCustomerSegment(customer({ orderCount: 0 }), NOW);
    expect(potansiyel.bg).toBe("bg-gray-100");

    const kayip = getCustomerSegment(customer({
      orderCount: 2, lastOrderDate: monthsAgo(14),
    }), NOW);
    expect(kayip.bg).toBe("bg-rose-100");
    expect(kayip.text).toBe("text-rose-800");
  });

  // ── Priority order ──
  it("VIP takes priority over Yeni (new customer with high spend)", () => {
    expect(getCustomerSegment(customer({
      orderCount: 2,
      totalOrderPrice: 25000,
      firstOrderDate: monthsAgo(1),
      lastOrderDate: monthsAgo(0),
    }), NOW).key).toBe("vip");
  });

  it("VIP takes priority over Sadık", () => {
    expect(getCustomerSegment(customer({
      orderCount: 10,
      totalOrderPrice: 15000,
      firstOrderDate: monthsAgo(24),
      lastOrderDate: monthsAgo(2),
    }), NOW).key).toBe("vip");
  });

  it("Kayıp takes priority over VIP when inactive", () => {
    expect(getCustomerSegment(customer({
      orderCount: 15,
      totalOrderPrice: 50000,
      firstOrderDate: monthsAgo(24),
      lastOrderDate: monthsAgo(13),
    }), NOW).key).toBe("kayip");
  });
});

// ─── CUSTOMER_SEGMENTS ─────────────────────────────────
describe("CUSTOMER_SEGMENTS", () => {
  it("has 7 segments (all + 6 real segments)", () => {
    expect(CUSTOMER_SEGMENTS).toHaveLength(7);
  });

  it("has all expected keys", () => {
    const keys = CUSTOMER_SEGMENTS.map((s) => s.key);
    expect(keys).toEqual(["all", "vip", "yeni", "sadik", "aktif", "kayip", "potansiyel"]);
  });

  it("first segment is 'all' (Tümü)", () => {
    expect(CUSTOMER_SEGMENTS[0].key).toBe("all");
    expect(CUSTOMER_SEGMENTS[0].label).toBe("Tümü");
  });

  it("each segment has bg, text, hoverBg, and description", () => {
    for (const seg of CUSTOMER_SEGMENTS) {
      expect(seg.bg).toMatch(/^bg-/);
      expect(seg.text).toMatch(/^text-/);
      expect(seg.hoverBg).toMatch(/^hover:bg-/);
      expect(seg.description).toBeTruthy();
    }
  });
});

// ─── CUSTOMER_SORT_OPTIONS ─────────────────────────────
describe("CUSTOMER_SORT_OPTIONS", () => {
  it("has 4 sort options", () => {
    expect(CUSTOMER_SORT_OPTIONS).toHaveLength(4);
  });

  it("has expected sort fields", () => {
    const values = CUSTOMER_SORT_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["lastOrderDate", "firstName", "orderCount", "totalOrderPrice"]);
  });

  it("marks server-side sort fields correctly", () => {
    const serverSide = CUSTOMER_SORT_OPTIONS.filter((o) => o.serverSide);
    const clientSide = CUSTOMER_SORT_OPTIONS.filter((o) => !o.serverSide);

    expect(serverSide.map((o) => o.value)).toEqual(["lastOrderDate", "firstName"]);
    expect(clientSide.map((o) => o.value)).toEqual(["orderCount", "totalOrderPrice"]);
  });
});

// ─── Segment coverage ──────────────────────────────────
describe("Segment coverage — all segments reachable", () => {
  const segments: CustomerSegmentKey[] = ["potansiyel", "kayip", "vip", "yeni", "sadik", "aktif"];

  const testCases: [string, CustomerSegmentInput, CustomerSegmentKey][] = [
    ["potansiyel — 0 orders", customer({ orderCount: 0 }), "potansiyel"],
    ["kayip — old order", customer({ orderCount: 3, lastOrderDate: monthsAgo(14) }), "kayip"],
    ["vip — high count recent", customer({ orderCount: 12, lastOrderDate: monthsAgo(1), firstOrderDate: monthsAgo(24) }), "vip"],
    ["vip — high spend recent", customer({ orderCount: 2, totalOrderPrice: 25000, lastOrderDate: monthsAgo(1), firstOrderDate: monthsAgo(6) }), "vip"],
    ["yeni — new customer", customer({ orderCount: 1, firstOrderDate: monthsAgo(1), lastOrderDate: monthsAgo(1) }), "yeni"],
    ["sadik — loyal", customer({ orderCount: 5, firstOrderDate: monthsAgo(18), lastOrderDate: monthsAgo(4) }), "sadik"],
    ["aktif — recent low count", customer({ orderCount: 1, firstOrderDate: monthsAgo(5), lastOrderDate: monthsAgo(3) }), "aktif"],
  ];

  for (const [label, input, expected] of testCases) {
    it(label, () => {
      expect(getCustomerSegment(input, NOW).key).toBe(expected);
    });
  }

  it("all non-all segments are covered", () => {
    const covered = new Set(testCases.map(([, , key]) => key));
    for (const seg of segments) {
      expect(covered.has(seg)).toBe(true);
    }
  });
});
