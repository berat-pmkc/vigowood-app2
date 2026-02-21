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

  // 4. Sample query
  const { data: sampleProduct, error: productError } = await supabase
    .from("products")
    .select("sku, urun_adi, aktif_mi")
    .limit(1)
    .maybeSingle();

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
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + "...",
    },
  });
}
