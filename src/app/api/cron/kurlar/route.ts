import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron endpoint: Frankfurter API'den günlük döviz kurlarını çeker.
 * Vercel Cron ile her gün 12:00 (Europe/Istanbul) tetiklenir.
 *
 * GET /api/cron/kurlar?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  // Güvenlik: CRON_SECRET kontrolü
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Frankfurter API — 1 TRY → USD, EUR, GBP, PLN, SEK
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP,PLN,SEK"
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Frankfurter API error: ${res.status}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      date: string;
      rates: { USD: number; EUR: number; GBP: number; PLN: number; SEK: number };
    };

    // Ters çevir: 1 X = ? TRY
    const usd_try = Math.round((1 / json.rates.USD) * 10000) / 10000;
    const eur_try = Math.round((1 / json.rates.EUR) * 10000) / 10000;
    const gbp_try = Math.round((1 / json.rates.GBP) * 10000) / 10000;
    const pln_try = Math.round((1 / json.rates.PLN) * 10000) / 10000;
    const sek_try = Math.round((1 / json.rates.SEK) * 10000) / 10000;

    // Çapraz kurlar
    const eur_usd = Math.round((eur_try / usd_try) * 10000) / 10000;
    const gbp_usd = Math.round((gbp_try / usd_try) * 10000) / 10000;
    const gbp_eur = Math.round((gbp_try / eur_try) * 10000) / 10000;

    // Supabase admin client (service role — RLS bypass)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
