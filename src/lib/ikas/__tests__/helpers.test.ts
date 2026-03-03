import { describe, it, expect } from "vitest";
import {
  getCustomerSegment,
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORT_OPTIONS,
  type CustomerSegmentKey,
} from "../helpers";

// ─── getCustomerSegment ────────────────────────────────
describe("getCustomerSegment", () => {
  it("returns VIP for orderCount >= 10", () => {
    expect(getCustomerSegment(10).key).toBe("vip");
    expect(getCustomerSegment(15).key).toBe("vip");
    expect(getCustomerSegment(100).key).toBe("vip");
  });

  it("returns Sadık for orderCount 3-9", () => {
    expect(getCustomerSegment(3).key).toBe("sadik");
    expect(getCustomerSegment(5).key).toBe("sadik");
    expect(getCustomerSegment(9).key).toBe("sadik");
  });

  it("returns Aktif for orderCount 1-2", () => {
    expect(getCustomerSegment(1).key).toBe("aktif");
    expect(getCustomerSegment(2).key).toBe("aktif");
  });

  it("returns Yeni for orderCount 0", () => {
    expect(getCustomerSegment(0).key).toBe("yeni");
  });

  it("returns Yeni for null orderCount", () => {
    expect(getCustomerSegment(null).key).toBe("yeni");
  });

  it("returns correct segment object with label and colors", () => {
    const vip = getCustomerSegment(12);
    expect(vip.label).toBe("VIP");
    expect(vip.bg).toBe("bg-amber-100");
    expect(vip.text).toBe("text-amber-800");

    const sadik = getCustomerSegment(5);
    expect(sadik.label).toBe("Sadık");
    expect(sadik.bg).toBe("bg-emerald-100");

    const aktif = getCustomerSegment(1);
    expect(aktif.label).toBe("Aktif");
    expect(aktif.bg).toBe("bg-blue-100");

    const yeni = getCustomerSegment(0);
    expect(yeni.label).toBe("Yeni");
    expect(yeni.bg).toBe("bg-gray-100");
  });

  // Boundary tests
  it("handles boundary values correctly", () => {
    expect(getCustomerSegment(9).key).toBe("sadik");  // upper boundary of Sadık
    expect(getCustomerSegment(10).key).toBe("vip");    // lower boundary of VIP
    expect(getCustomerSegment(2).key).toBe("aktif");   // upper boundary of Aktif
    expect(getCustomerSegment(3).key).toBe("sadik");   // lower boundary of Sadık
    expect(getCustomerSegment(0).key).toBe("yeni");    // Yeni boundary
    expect(getCustomerSegment(1).key).toBe("aktif");   // lower boundary of Aktif
  });
});

// ─── CUSTOMER_SEGMENTS ─────────────────────────────────
describe("CUSTOMER_SEGMENTS", () => {
  it("has 5 segments", () => {
    expect(CUSTOMER_SEGMENTS).toHaveLength(5);
  });

  it("has all expected keys", () => {
    const keys = CUSTOMER_SEGMENTS.map((s) => s.key);
    expect(keys).toEqual(["all", "vip", "sadik", "aktif", "yeni"]);
  });

  it("first segment is 'all' (Tümü)", () => {
    expect(CUSTOMER_SEGMENTS[0].key).toBe("all");
    expect(CUSTOMER_SEGMENTS[0].label).toBe("Tümü");
  });

  it("each segment has bg and text color classes", () => {
    for (const seg of CUSTOMER_SEGMENTS) {
      expect(seg.bg).toMatch(/^bg-/);
      expect(seg.text).toMatch(/^text-/);
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

  it("each option has a label", () => {
    for (const opt of CUSTOMER_SORT_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(typeof opt.label).toBe("string");
    }
  });
});

// ─── Client-side filtering logic (simulated) ──────────
describe("Customer segment filtering (client-side simulation)", () => {
  // Simulate the filtering logic from musteriler-client.tsx
  const mockCustomers = [
    { orderCount: 18 },  // VIP
    { orderCount: 12 },  // VIP
    { orderCount: 10 },  // VIP
    { orderCount: 9 },   // Sadık
    { orderCount: 5 },   // Sadık
    { orderCount: 3 },   // Sadık
    { orderCount: 2 },   // Aktif
    { orderCount: 1 },   // Aktif
    { orderCount: 1 },   // Aktif
    { orderCount: 0 },   // Yeni
    { orderCount: null }, // Yeni (null → 0)
  ];

  function filterBySegment(customers: typeof mockCustomers, segment: CustomerSegmentKey) {
    if (segment === "all") return customers;
    return customers.filter((c) => getCustomerSegment(c.orderCount).key === segment);
  }

  function countSegments(customers: typeof mockCustomers) {
    const counts: Record<CustomerSegmentKey, number> = { all: customers.length, vip: 0, sadik: 0, aktif: 0, yeni: 0 };
    for (const c of customers) {
      const seg = getCustomerSegment(c.orderCount);
      if (seg.key !== "all") counts[seg.key]++;
    }
    return counts;
  }

  it("filters VIP correctly", () => {
    const filtered = filterBySegment(mockCustomers, "vip");
    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => (c.orderCount ?? 0) >= 10)).toBe(true);
  });

  it("filters Sadık correctly", () => {
    const filtered = filterBySegment(mockCustomers, "sadik");
    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => {
      const count = c.orderCount ?? 0;
      return count >= 3 && count <= 9;
    })).toBe(true);
  });

  it("filters Aktif correctly", () => {
    const filtered = filterBySegment(mockCustomers, "aktif");
    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => {
      const count = c.orderCount ?? 0;
      return count >= 1 && count <= 2;
    })).toBe(true);
  });

  it("filters Yeni correctly (includes null orderCount)", () => {
    const filtered = filterBySegment(mockCustomers, "yeni");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((c) => (c.orderCount ?? 0) === 0)).toBe(true);
  });

  it("'all' returns all customers", () => {
    const filtered = filterBySegment(mockCustomers, "all");
    expect(filtered).toHaveLength(11);
  });

  it("segment counts add up to total", () => {
    const counts = countSegments(mockCustomers);
    expect(counts.all).toBe(11);
    expect(counts.vip + counts.sadik + counts.aktif + counts.yeni).toBe(11);
  });

  it("segment counts are correct", () => {
    const counts = countSegments(mockCustomers);
    expect(counts.vip).toBe(3);
    expect(counts.sadik).toBe(3);
    expect(counts.aktif).toBe(3);
    expect(counts.yeni).toBe(2);
  });
});

// ─── Client-side sorting logic (simulated) ─────────────
describe("Customer sorting (client-side simulation)", () => {
  const mockCustomers = [
    { firstName: "Zeynep", orderCount: 5, totalOrderPrice: 3000, lastOrderDate: 1000 },
    { firstName: "Ahmet", orderCount: 18, totalOrderPrice: 24500, lastOrderDate: 3000 },
    { firstName: "Mehmet", orderCount: 1, totalOrderPrice: 500, lastOrderDate: 2000 },
  ];

  type SortField = "firstName" | "orderCount" | "totalOrderPrice" | "lastOrderDate";

  function sortCustomers(customers: typeof mockCustomers, field: SortField, dir: "asc" | "desc") {
    return [...customers].sort((a, b) => {
      const aVal = a[field] ?? 0;
      const bVal = b[field] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return dir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }

  it("sorts by orderCount desc", () => {
    const sorted = sortCustomers(mockCustomers, "orderCount", "desc");
    expect(sorted[0].firstName).toBe("Ahmet");     // 18
    expect(sorted[1].firstName).toBe("Zeynep");     // 5
    expect(sorted[2].firstName).toBe("Mehmet");      // 1
  });

  it("sorts by orderCount asc", () => {
    const sorted = sortCustomers(mockCustomers, "orderCount", "asc");
    expect(sorted[0].firstName).toBe("Mehmet");      // 1
    expect(sorted[2].firstName).toBe("Ahmet");       // 18
  });

  it("sorts by totalOrderPrice desc", () => {
    const sorted = sortCustomers(mockCustomers, "totalOrderPrice", "desc");
    expect(sorted[0].totalOrderPrice).toBe(24500);
    expect(sorted[2].totalOrderPrice).toBe(500);
  });

  it("sorts by lastOrderDate desc", () => {
    const sorted = sortCustomers(mockCustomers, "lastOrderDate", "desc");
    expect(sorted[0].lastOrderDate).toBe(3000);
    expect(sorted[2].lastOrderDate).toBe(1000);
  });
});
