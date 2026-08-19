import { NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { diaGunlukSatisSenkron } from "@/lib/dia/satis";

/**
 * Cron: DİA'dan satış faturalarını çekip sisteme işler.
 *
 * Vercel her gün 15:10 UTC'de tetikler = 18:10 Türkiye saati.
 * (Vercel cron ifadeleri UTC'dir; yaz saati uygulaması olmadığı için
 *  TR yıl boyu UTC+3, dolayısıyla sabit 3 saat fark.)
 *
 * Son 3 gün taranır — DİA'ya geç girilen faturalar da yakalansın diye.
 * Aynı faturanın ikinci kez yazılmasını fatura no kontrolü engelliyor.
 *
 * GET /api/cron/dia-satis?secret=CRON_SECRET
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, "cron-dia-satis"), {
    limit: 2,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gun = Number(searchParams.get("gun")) || 3;

  try {
    const sonuc = await diaGunlukSatisSenkron(Math.min(Math.max(gun, 1), 31));
    return NextResponse.json({ success: true, ...sonuc });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}
