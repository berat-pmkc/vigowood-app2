import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { syncCustomers } from "@/lib/ikas/sync";

/**
 * Cron: İkas müşteri sync
 * Her gece 03:00'te VPS cron job ile çağrılır.
 * GET /api/cron/ikas-customers?secret=CRON_SECRET
 */
export const maxDuration = 300; // 5 minutes max (müşteri sync uzun sürebilir)

export async function GET(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, "cron-ikas-customers"), { limit: 2, windowSeconds: 60 });
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

    const result = await syncCustomers(supabase);

    return NextResponse.json({
      success: !result.error,
      customers: result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
