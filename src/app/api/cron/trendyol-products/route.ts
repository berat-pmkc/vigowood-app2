import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { syncProducts } from "@/lib/trendyol/sync";

/**
 * Cron: Trendyol ürünler sync
 * Her 1 saatte bir çalışır.
 * GET /api/cron/trendyol-products?secret=CRON_SECRET
 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, "cron-trendyol-products"), { limit: 2, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await syncProducts(supabase);

    return NextResponse.json({ success: true, products: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
