import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * Cron endpoint: Haftalık fiyat snapshot'ı
 * Her Pazar 23:00 UTC tetiklenir.
 * Tüm aktif marketplace listing'lerini pricing_snapshots tablosuna kaydeder.
 *
 * GET /api/cron/pricing-snapshot?secret=CRON_SECRET
 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, "cron-pricing-snapshot"), { limit: 2, windowSeconds: 60 });
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

    // Get all active marketplaces
    const { data: marketplaces, error: mpErr } = await supabase
      .from("marketplaces")
      .select("id, code")
      .eq("aktif", true);

    if (mpErr) throw new Error(mpErr.message);
    if (!marketplaces || marketplaces.length === 0) {
      return NextResponse.json({ message: "No active marketplaces", duration: Date.now() - startTime });
    }

    // Generate weekly period code: YYYY-WKxx
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const donemKodu = `${now.getFullYear()}-WK${String(weekNumber).padStart(2, "0")}`;

    let totalSnapshots = 0;

    for (const mp of marketplaces) {
      // Get all active listings for this marketplace
      const { data: listings } = await supabase
        .from("marketplace_listings")
        .select("sku, listing_kodu, satis_fiyati, komisyon_orani, reklam_orani, kargo_maliyeti, ham_fiyat, kar_marji, hedef_fiyat_kullanilan")
        .eq("marketplace_id", mp.id)
        .eq("aktif", true);

      if (!listings || listings.length === 0) continue;

      const snapshots = listings.map((l: any) => ({
        donem_kodu: donemKodu,
        marketplace_id: mp.id,
        sku: l.sku,
        listing_kodu: l.listing_kodu,
        satis_fiyati: l.satis_fiyati,
        komisyon_orani: l.komisyon_orani,
        reklam_orani: l.reklam_orani,
        kargo_maliyeti: l.kargo_maliyeti,
        ham_fiyat: l.ham_fiyat,
        kar_marji: l.kar_marji,
        hedef_fiyat: l.hedef_fiyat_kullanilan,
        created_by: "CRON_HAFTALIK",
      }));

      const { error: insertErr } = await supabase
        .from("pricing_snapshots")
        .insert(snapshots);

      if (insertErr) {
        console.error(`Pricing snapshot insert error for ${mp.code}:`, insertErr.message);
      } else {
        totalSnapshots += snapshots.length;
      }
    }

    return NextResponse.json({
      success: true,
      donem_kodu: donemKodu,
      marketplaces: marketplaces.length,
      snapshots: totalSnapshots,
      duration: Date.now() - startTime,
    });
  } catch (e) {
    console.error("Pricing snapshot cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
