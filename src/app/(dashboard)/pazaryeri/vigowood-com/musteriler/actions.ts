"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import type { IkasCustomerDB } from "@/lib/supabase/types";

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  segment?: string;
}

export interface CustomerListResult {
  customers: IkasCustomerDB[];
  totalCount: number;
  hasNext: boolean;
}

export async function getCustomersFromDB(
  params: CustomerListParams
): Promise<CustomerListResult> {
  const user = await getCurrentUser();
  if (
    !user ||
    !MARKETPLACE_ACCESS_ROLES.includes(
      user.role as (typeof MARKETPLACE_ACCESS_ROLES)[number]
    )
  ) {
    throw new Error("Yetkisiz erişim");
  }

  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Sort column mapping
  const sortMap: Record<string, string> = {
    lastOrderDate: "last_order_date",
    firstName: "first_name",
    orderCount: "order_count",
    totalOrderPrice: "total_spent",
  };
  const sortCol = sortMap[params.sort ?? "lastOrderDate"] ?? "last_order_date";
  const ascending = params.dir === "asc";

  let query = supabase
    .from("ikas_customers")
    .select("*", { count: "exact" });

  // Search
  if (params.search) {
    const s = params.search;
    query = query.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`
    );
  }

  // Segment filter
  if (params.segment && params.segment !== "all") {
    query = query.eq("customer_segment", params.segment);
  }

  // Sort + paginate
  query = query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("[getCustomersFromDB] Hata:", error.message);
    throw new Error(error.message);
  }

  return {
    customers: (data ?? []) as IkasCustomerDB[],
    totalCount: count ?? 0,
    hasNext: (count ?? 0) > from + pageSize,
  };
}

export async function getSegmentCounts(): Promise<
  Record<string, number>
> {
  const user = await getCurrentUser();
  if (
    !user ||
    !MARKETPLACE_ACCESS_ROLES.includes(
      user.role as (typeof MARKETPLACE_ACCESS_ROLES)[number]
    )
  ) {
    return {};
  }

  const supabase = await createClient();

  // Segment bazlı count
  const segments = ["vip", "sadik", "aktif", "yeni", "kayip", "potansiyel"];
  const counts: Record<string, number> = { all: 0 };

  // Toplam
  const { count: total } = await supabase
    .from("ikas_customers")
    .select("*", { count: "exact", head: true });
  counts.all = total ?? 0;

  // Her segment
  await Promise.all(
    segments.map(async (seg) => {
      const { count } = await supabase
        .from("ikas_customers")
        .select("*", { count: "exact", head: true })
        .eq("customer_segment", seg);
      counts[seg] = count ?? 0;
    })
  );

  return counts;
}
