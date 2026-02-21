import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  // 2. User profile
  let profile = null;
  if (authUser) {
    const { data } = await supabase
      .from("users")
      .select("user_id, role, full_name")
      .eq("auth_id", authUser.id)
      .single();
    profile = data;
    if (!data && authUser.email) {
      const { data: emailData } = await supabase
        .from("users")
        .select("user_id, role, full_name")
        .eq("email", authUser.email)
        .single();
      profile = emailData;
    }
  }

  // 3. Table counts - each explicitly typed
  const { count: productsCount, error: productsErr } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  const { count: sablonCount, error: sablonErr } = await supabase
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact", head: true });

  const { count: fiyatCount, error: fiyatErr } = await supabase
    .from("sevkiyat_fiyatlar")
    .select("*", { count: "exact", head: true });

  const { count: smCount, error: smErr } = await supabase
    .from("stock_movements")
    .select("*", { count: "exact", head: true });

  const { count: partsCount, error: partsErr } = await supabase
    .from("all_parts")
    .select("*", { count: "exact", head: true });

  const { count: sevkCount, error: sevkErr } = await supabase
    .from("sevkiyat")
    .select("*", { count: "exact", head: true });

  const { count: usersCount, error: usersErr } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // 4. Sample query (specific columns)
  const { data: sampleProduct, error: productError } = await supabase
    .from("products")
    .select("sku, urun_adi, aktif_mi")
    .limit(1)
    .maybeSingle();

  // 5. EXACT same query as admin/urunler page
  const { data: pageProducts, count: pageCount, error: pageError } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);

  // 6. select("*") WITHOUT range
  const { data: allProducts, error: allError } = await supabase
    .from("products")
    .select("*")
    .limit(5);

  // 7. select specific columns with range
  const { data: specificProducts, error: specificError } = await supabase
    .from("products")
    .select("sku, urun_adi, aktif_mi, kategori")
    .order("sku", { ascending: true })
    .range(0, 4);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    auth: {
      hasUser: !!authUser,
      userId: authUser?.id ?? null,
      email: authUser?.email ?? null,
      authError: authError?.message ?? null,
    },
    profile: profile ?? "NOT_FOUND",
    tableCounts: {
      products: { count: productsCount, error: productsErr?.message ?? null },
      sevkiyat_palet_sablon: { count: sablonCount, error: sablonErr?.message ?? null },
      sevkiyat_fiyatlar: { count: fiyatCount, error: fiyatErr?.message ?? null },
      stock_movements: { count: smCount, error: smErr?.message ?? null },
      all_parts: { count: partsCount, error: partsErr?.message ?? null },
      sevkiyat: { count: sevkCount, error: sevkErr?.message ?? null },
      users: { count: usersCount, error: usersErr?.message ?? null },
    },
    sampleProduct: sampleProduct ?? null,
    sampleProductError: productError?.message ?? null,
    queryTests: {
      pageQuery: {
        description: "select('*', count:'exact').order('sku').range(0,24) — same as admin/urunler",
        dataLength: pageProducts?.length ?? 0,
        count: pageCount,
        error: pageError?.message ?? null,
        firstItem: pageProducts?.[0] ? { sku: (pageProducts[0] as Record<string, unknown>).sku } : null,
      },
      allQuery: {
        description: "select('*').limit(5) — no range",
        dataLength: allProducts?.length ?? 0,
        error: allError?.message ?? null,
        firstItem: allProducts?.[0] ? { sku: (allProducts[0] as Record<string, unknown>).sku } : null,
      },
      specificQuery: {
        description: "select('sku,urun_adi,aktif_mi,kategori').range(0,4)",
        dataLength: specificProducts?.length ?? 0,
        error: specificError?.message ?? null,
        firstItem: specificProducts?.[0] ?? null,
      },
    },
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + "...",
    },
  });
}
