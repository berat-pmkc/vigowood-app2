import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { syncOrders, syncProducts, syncQuestions, syncSettlements, syncOtherFinancials, syncClaims } from "@/lib/trendyol/sync";

/**
 * Manuel sync endpoint — Kullanıcı tarafından tetiklenir.
 * POST /api/trendyol-sync
 * Body: { entity: "orders" | "products" | "questions" | "settlements" | "all" }
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  // Rate limit: 3 req/dk
  const rl = rateLimit(getRateLimitKey(request, "trendyol-sync"), { limit: 3, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
  }

  // Auth check
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }

  try {
    const body = await request.json() as { entity?: string };
    const entity = body.entity || "all";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results: Record<string, { synced: number; error?: string }> = {};

    if (entity === "all" || entity === "orders") {
      results.orders = await syncOrders(supabase);
    }
    if (entity === "all" || entity === "products") {
      results.products = await syncProducts(supabase);
    }
    if (entity === "all" || entity === "questions") {
      results.questions = await syncQuestions(supabase);
    }
    if (entity === "all" || entity === "settlements") {
      results.settlements = await syncSettlements(supabase);
    }
    if (entity === "all" || entity === "otherfinancials") {
      results.otherfinancials = await syncOtherFinancials(supabase);
    }
    if (entity === "all" || entity === "claims") {
      results.claims = await syncClaims(supabase);
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
