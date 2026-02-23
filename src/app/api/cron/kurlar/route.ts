import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * Cron endpoint: Frankfurter API'den günlük döviz kurlarını çeker.
 * Vercel Cron ile her gün 12:00 (Europe/Istanbul) tetiklenir.
 *
 * GET /api/cron/kurlar?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  // Rate limit: 2 req/dk
  const rl = rateLimit(getRateLimitKey(request, "cron-kurlar"), { limit: 2, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Güvenlik: CRON_SECRET kontrolü
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Supabase admin client (service role — RLS bypass)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Kur ayarlarını DB'den oku (fallback: hardcoded)
    let currencies = ["USD", "EUR", "GBP", "PLN", "SEK"];
    try {
      const { data: settingsRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sevkiyat_kur_ayarlari")
        .maybeSingle();
      if (settingsRow?.value) {
        const parsed = settingsRow.value as { currencies?: string[] };
        if (Array.isArray(parsed.currencies) && parsed.currencies.length > 0) {
          currencies = parsed.currencies;
        }
      }
    } catch {
      // Fallback — hardcoded currencies
    }

    // Frankfurter API — 1 TRY → dynamic currencies
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=TRY&to=${currencies.join(",")}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Frankfurter API error: ${res.status}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      date: string;
      rates: Record<string, number>;
    };

    // Ters çevir: 1 X = ? TRY (sadece gelen kurlar için)
    const usd_try = json.rates.USD ? Math.round((1 / json.rates.USD) * 10000) / 10000 : null;
    const eur_try = json.rates.EUR ? Math.round((1 / json.rates.EUR) * 10000) / 10000 : null;
    const gbp_try = json.rates.GBP ? Math.round((1 / json.rates.GBP) * 10000) / 10000 : null;
    const pln_try = json.rates.PLN ? Math.round((1 / json.rates.PLN) * 10000) / 10000 : null;
    const sek_try = json.rates.SEK ? Math.round((1 / json.rates.SEK) * 10000) / 10000 : null;

    // Çapraz kurlar
    const eur_usd = eur_try && usd_try ? Math.round((eur_try / usd_try) * 10000) / 10000 : null;
    const gbp_usd = gbp_try && usd_try ? Math.round((gbp_try / usd_try) * 10000) / 10000 : null;
    const gbp_eur = gbp_try && eur_try ? Math.round((gbp_try / eur_try) * 10000) / 10000 : null;

    const { error } = await supabase.from("doviz_kurlari").upsert(
      {
        tarih: json.date,
        usd_try,
        eur_try,
        gbp_try,
        pln_try,
        sek_try,
        eur_usd,
        gbp_usd,
        gbp_eur,
        kaynak: "frankfurter",
      },
      { onConflict: "tarih" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      date: json.date,
      rates: { usd_try, eur_try, gbp_try, pln_try, sek_try },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
