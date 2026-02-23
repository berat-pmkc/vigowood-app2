import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SATIS_ACCESS_ROLES, isExportChannel } from "@/lib/constants";
import {
  SatisRaporDocument,
  type SkuAggRow,
  type KanalAggRow,
} from "@/lib/pdf/satis-rapor-template";
import React from "react";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  // Rate limit: 5 req/dk
  const rl = rateLimit(getRateLimitKey(_request, "satis-rapor-pdf"), { limit: 5, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const user = await getCurrentUser();
    if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 403 },
      );
    }

    const { id: raporId } = await params;
    const supabase = await createClient();

    const { data: raporData, error: raporErr } = await supabase
      .from("satis_raporlari")
      .select("*")
      .eq("rapor_id", raporId)
      .single();

    if (raporErr || !raporData) {
      return NextResponse.json(
        { error: "Rapor bulunamadı" },
        { status: 404 },
      );
    }

    const rapor = raporData as {
      rapor_id: string;
      rapor_tarihi: string;
      yukleme_tarihi: string;
      toplam_adet: number;
      toplam_tutar: number;
      tr_tutar: number;
      ihracat_tutar: number;
    };

    const { data: satirlar } = await supabase
      .from("satis_satirlari")
      .select("sku, miktar, toplam_tutar, satis_kanali, is_hizmet")
      .eq("rapor_id", raporId);

    const rows = (satirlar || []) as {
      sku: string | null;
      miktar: number;
      toplam_tutar: number;
      satis_kanali: string | null;
      is_hizmet: boolean;
    }[];

    const trMap = new Map<string, { adet: number; tutar: number }>();
    const ihracatMap = new Map<
      string,
      { adet: number; tutar: number }
    >();
    const kanalMap = new Map<
      string,
      { adet: number; tutar: number }
    >();

    for (const r of rows) {
      if (!r.sku || r.is_hizmet) continue;
      const isExport = r.satis_kanali
        ? isExportChannel(r.satis_kanali)
        : false;
      const skuMap = isExport ? ihracatMap : trMap;
      const existing = skuMap.get(r.sku) || { adet: 0, tutar: 0 };
      existing.adet += r.miktar || 0;
      existing.tutar += r.toplam_tutar || 0;
      skuMap.set(r.sku, existing);

      const kanal = r.satis_kanali || "DİĞER";
      const kExisting = kanalMap.get(kanal) || { adet: 0, tutar: 0 };
      kExisting.adet += r.miktar || 0;
      kExisting.tutar += r.toplam_tutar || 0;
      kanalMap.set(kanal, kExisting);
    }

    const toRows = (
      map: Map<string, { adet: number; tutar: number }>,
    ): SkuAggRow[] =>
      Array.from(map.entries())
        .map(([sku, v]) => ({ sku, adet: v.adet, tutar: v.tutar }))
        .sort((a, b) => b.adet - a.adet);

    const kanalRows: KanalAggRow[] = Array.from(kanalMap.entries())
      .map(([kanal, v]) => ({ kanal, adet: v.adet, tutar: v.tutar }))
      .sort((a, b) => b.tutar - a.tutar);

    const formatDateTR = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    const element = React.createElement(SatisRaporDocument, {
      raporId: rapor.rapor_id,
      raporTarihi: formatDateTR(rapor.rapor_tarihi),
      olusturmaTarihi: formatDateTR(rapor.yukleme_tarihi),
      trRows: toRows(trMap),
      ihracatRows: toRows(ihracatMap),
      kanalRows,
      toplamAdet: rapor.toplam_adet,
      toplamTutar: rapor.toplam_tutar,
      trTutar: rapor.tr_tutar,
      ihracatTutar: rapor.ihracat_tutar,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    return new NextResponse(Buffer.from(pdfBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="satis-rapor-${raporId}.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF generation error:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "PDF oluşturma hatası",
      },
      { status: 500 },
    );
  }
}
