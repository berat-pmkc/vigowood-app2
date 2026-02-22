import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FINANCE_ROLES } from "@/lib/constants";
import {
  NAKIT_GIRIS_LABELS,
  NAKIT_GIRIS_TL_KOLONLAR,
  NAKIT_GIRIS_USD_KOLONLAR,
  NAKIT_CIKIS_TL_LABELS,
  NAKIT_CIKIS_TL_KOLONLAR,
  NAKIT_CIKIS_USD_LABELS,
  NAKIT_CIKIS_USD_KOLONLAR,
} from "@/lib/constants";
import {
  NakitAkisRaporDocument,
  type NakitAkisRaporPdfProps,
} from "@/lib/pdf/nakit-akis-rapor-template";
import type { NakitDonem } from "@/lib/supabase/types";
import React from "react";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id: donemId } = await params;
    const supabase = await createClient();

    // Parallel queries
    const [donemResult, girisResult, cikisResult] = await Promise.all([
      supabase.from("nakit_donemler").select("*").eq("id", donemId).single(),
      supabase.from("nakit_girisler").select("*").eq("donem_id", donemId).single(),
      supabase.from("nakit_cikislar").select("*").eq("donem_id", donemId).single(),
    ]);

    if (donemResult.error || !donemResult.data) {
      return NextResponse.json({ error: "Dönem bulunamadı" }, { status: 404 });
    }

    const donem = donemResult.data as NakitDonem;
    const giris = girisResult.data as Record<string, unknown> | null;
    const cikis = cikisResult.data as Record<string, unknown> | null;

    const n = (v: unknown) => Number(v) || 0;

    const toplamBorc =
      n(donem.toplam_piyasa_borcu) + n(donem.toplam_kk_borc) + n(donem.toplam_finansal_borc);

    // Format dates
    const formatDateTR = (iso: string | null) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    const tarihAraligi = `${formatDateTR(donem.baslangic_tarihi)} — ${formatDateTR(donem.bitis_tarihi)}`;

    // Build giriş arrays
    const girisler = NAKIT_GIRIS_TL_KOLONLAR.map((col) => ({
      label: NAKIT_GIRIS_LABELS[col] || col,
      value: giris ? n(giris[col]) : 0,
    }));
    const girisUsdler = NAKIT_GIRIS_USD_KOLONLAR.map((col) => ({
      label: NAKIT_GIRIS_LABELS[col] || col,
      value: giris ? n(giris[col]) : 0,
    }));

    // Build çıkış arrays
    const cikislar = NAKIT_CIKIS_TL_KOLONLAR.map((col) => ({
      label: NAKIT_CIKIS_TL_LABELS[col] || col,
      value: cikis ? n(cikis[col]) : 0,
    }));
    const cikisUsdler = NAKIT_CIKIS_USD_KOLONLAR.map((col) => ({
      label: NAKIT_CIKIS_USD_LABELS[col] || col,
      value: cikis ? n(cikis[col]) : 0,
    }));

    const props: NakitAkisRaporPdfProps = {
      donemKodu: donem.donem_kodu,
      tarihAraligi,
      olusturmaTarihi: new Date().toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      kurBilgisi: n(donem.kur_bilgisi),
      nakitTl: n(donem.varlik_tl),
      nakitUsd: n(donem.varlik_usd),
      toplamVarlik: n(donem.toplam_varlik_tl),
      toplamBorc,
      netPozisyon: n(donem.toplam_varlik_tl) - toplamBorc,
      varlikAcilisTl: n(donem.varlik_acilis_tl),
      varlikAcilisUsd: n(donem.varlik_acilis_usd),
      nakitGirisTl: n(donem.nakit_giris_tl),
      nakitGirisUsd: n(donem.nakit_giris_usd),
      nakitCikisTl: n(donem.nakit_cikis_tl),
      nakitCikisUsd: n(donem.nakit_cikis_usd),
      varlikTl: n(donem.varlik_tl),
      varlikUsd: n(donem.varlik_usd),
      yatirimTl: n(donem.yatirim_tl),
      toplamVarlikTl: n(donem.toplam_varlik_tl),
      gayrinakitIslem: n(donem.gayrinakit_islem),
      toplamPiyasaBorcu: n(donem.toplam_piyasa_borcu),
      toplamKkBorc: n(donem.toplam_kk_borc),
      toplamFinansalBorc: n(donem.toplam_finansal_borc),
      girisler,
      girisToplamTl: giris ? n(giris.toplam_tl) : 0,
      girisUsdler,
      girisToplamUsd: giris ? n(giris.toplam_yurtdisi) : 0,
      cikislar,
      cikisToplamTl: cikis ? n(cikis.toplam_tl) : 0,
      cikisUsdler,
      cikisToplamUsd: cikis ? n(cikis.toplam_yurtdisi_usd) : 0,
    };

    const element = React.createElement(NakitAkisRaporDocument, props);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    return new NextResponse(Buffer.from(pdfBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nakit-akis-${donem.donem_kodu}.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF generation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF oluşturma hatası" },
      { status: 500 },
    );
  }
}
