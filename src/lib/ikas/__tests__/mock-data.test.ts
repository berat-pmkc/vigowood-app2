import { describe, it, expect } from "vitest";
import { getMockCustomers, getMockOrders, getMockProducts } from "../mock-data";
import { getCustomerSegment, type CustomerSegmentKey } from "../helpers";

// ─── getMockCustomers ──────────────────────────────────
describe("getMockCustomers", () => {
  it("returns all customers when no params", () => {
    const result = getMockCustomers();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.count).toBe(result.data.length);
  });

  it("count reflects total filtered results, not page size", () => {
    // This was the bug: count was data.length (page slice) instead of filtered.length
    const allResult = getMockCustomers({ limit: 5 });
    expect(allResult.data).toHaveLength(5);
    expect(allResult.count).toBeGreaterThan(5); // count should be total, not page
    expect(allResult.hasNext).toBe(true);
  });

  it("pagination works correctly", () => {
    const page1 = getMockCustomers({ page: 1, limit: 10 });
    const page2 = getMockCustomers({ page: 2, limit: 10 });

    expect(page1.data).toHaveLength(10);
    expect(page1.page).toBe(1);
    expect(page1.hasNext).toBe(true);

    expect(page2.data).toHaveLength(10);
    expect(page2.page).toBe(2);

    // No overlap
    const page1Ids = new Set(page1.data.map((c) => c.id));
    for (const c of page2.data) {
      expect(page1Ids.has(c.id)).toBe(false);
    }
  });

  it("search filters by name", () => {
    const result = getMockCustomers({ search: "Ahmet" });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes("ahmet") ||
      c.email.toLowerCase().includes("ahmet")
    )).toBe(true);
    expect(result.count).toBe(result.data.length);
  });

  it("search with no match returns empty", () => {
    const result = getMockCustomers({ search: "XYZ_NONEXISTENT_12345" });
    expect(result.data).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.hasNext).toBe(false);
  });

  it("has customers in all segments", () => {
    const result = getMockCustomers({ limit: 100 });
    const segments = new Set<CustomerSegmentKey>();
    for (const c of result.data) {
      segments.add(getCustomerSegment(c.orderCount).key);
    }
    expect(segments.has("vip")).toBe(true);
    expect(segments.has("sadik")).toBe(true);
    expect(segments.has("aktif")).toBe(true);
    expect(segments.has("yeni")).toBe(true);
  });

  it("segment distribution is reasonable (at least 3 per segment)", () => {
    const result = getMockCustomers({ limit: 100 });
    const counts: Record<string, number> = { vip: 0, sadik: 0, aktif: 0, yeni: 0 };
    for (const c of result.data) {
      const seg = getCustomerSegment(c.orderCount);
      if (seg.key !== "all") counts[seg.key]++;
    }
    expect(counts.vip).toBeGreaterThanOrEqual(3);
    expect(counts.sadik).toBeGreaterThanOrEqual(3);
    expect(counts.aktif).toBeGreaterThanOrEqual(3);
    expect(counts.yeni).toBeGreaterThanOrEqual(3);
  });

  it("customers have valid data", () => {
    const result = getMockCustomers({ limit: 100 });
    for (const c of result.data) {
      expect(c.id).toBeTruthy();
      expect(c.firstName).toBeTruthy();
      expect(c.lastName).toBeTruthy();
      expect(c.email).toContain("@");
      expect(typeof c.orderCount).toBe("number");
      expect(typeof c.totalOrderPrice).toBe("number");
    }
  });

  it("Yeni customers have null dates", () => {
    const result = getMockCustomers({ limit: 100 });
    const yeniCustomers = result.data.filter((c) => (c.orderCount ?? 0) === 0);
    for (const c of yeniCustomers) {
      expect(c.firstOrderDate).toBeNull();
      expect(c.lastOrderDate).toBeNull();
    }
  });
});

// ─── getMockOrders count fix ───────────────────────────
describe("getMockOrders", () => {
  it("count reflects total, not page size", () => {
    const result = getMockOrders({ limit: 5 });
    expect(result.data).toHaveLength(5);
    expect(result.count).toBeGreaterThan(5);
    expect(result.hasNext).toBe(true);
  });
});

// ─── getMockProducts count fix ─────────────────────────
describe("getMockProducts", () => {
  it("count reflects total, not page size", () => {
    const allProducts = getMockProducts({ limit: 100 });
    if (allProducts.count > 5) {
      const paged = getMockProducts({ limit: 5 });
      expect(paged.data).toHaveLength(5);
      expect(paged.count).toBe(allProducts.count);
    }
  });
});
