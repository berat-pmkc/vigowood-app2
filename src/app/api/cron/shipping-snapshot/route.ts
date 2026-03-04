import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * Cron endpoint: Aylık kargo desi fiyat snapshot'ı
 * Her ayın 1'i 01:00 UTC tetiklenir.
 * Tüm aktif shipping_providers'ın desi_fiyatlari'nı shipping_snapshots'a kaydeder.
 *
 * GET /api/cron/shipping-snapshot?secret=CRON_SECRET
 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, "cron-shipping-snapshot"), { limit: 2, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active shipping providers
    const { data: providers, error: spErr } = await supabase
      .from("shipping_providers")
      .select("id, name, code, desi_fiyatlari")
      .eq("aktif", true);

    if (spErr) throw new Error(spErr.message);
    if (!providers || providers.length === 0) {
      return NextResponse.json({ message: "No active shipping providers", duration: Date.now() - startTime });
    }

    // Monthly period code: YYYY-MM
    const now = new Date();
    const donemKodu = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const snapshots = providers.map((sp: any) => ({
      donem_kodu: donemKodu,
      shipping_provider_id: sp.id,
      provider_name: sp.name,
      provider_code: sp.code,
      desi_fiyatlari: sp.desi_fiyatlari,
      created_by: "CRON_AYLIK",
    }));

    const { error: insertErr } = await supabase
      .from("shipping_snapshots")
      .insert(snapshots);

    if (insertErr) throw new Error(insertErr.message);

    return NextResponse.json({
      success: true,
      donem_kodu: donemKodu,
      providers: providers.length,
      duration: Date.now() - startTime,
    });
  } catch (e) {
    console.error("Shipping snapshot cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
