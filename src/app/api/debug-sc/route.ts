import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This tests if Server Component context behaves differently from API routes
export async function GET() {
  const supabase = await createClient();

  // Test 1: select("*") with count and range - same as page.tsx
  const q1 = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);

  // Test 2: select specific columns
  const q2 = await supabase
    .from("products")
    .select("sku, urun_adi")
    .limit(3);

  // Test 3: sevkiyat_palet_sablon - same as sablonlar page
  const q3 = await supabase
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);

  // Test 4: Check if the issue is with types.ts Database type
  // by fetching raw and checking if data is actually there
  const q5 = await supabase
    .from("products")
    .select("*")
    .limit(1);

  return NextResponse.json({
    test1_selectStar_range: {
      dataLength: q1.data?.length ?? 0,
      count: q1.count,
      error: q1.error?.message ?? null,
      dataType: typeof q1.data,
      isArray: Array.isArray(q1.data),
      firstSku: q1.data?.[0] ? (q1.data[0] as Record<string, unknown>).sku : null,
    },
    test2_specificCols: {
      dataLength: q2.data?.length ?? 0,
      error: q2.error?.message ?? null,
      data: q2.data,
    },
    test3_sablonlar: {
      dataLength: q3.data?.length ?? 0,
      count: q3.count,
      error: q3.error?.message ?? null,
    },
    test5_selectStar_limit1: {
      dataLength: q5.data?.length ?? 0,
      error: q5.error?.message ?? null,
      dataKeys: q5.data?.[0] ? Object.keys(q5.data[0] as Record<string, unknown>) : [],
      rawData: q5.data?.[0] ?? null,
    },
  });
}
