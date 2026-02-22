import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FINANCE_ROLES } from "@/lib/constants";
import {
  OdemeListesiDocument,
  type OdemeRow,
  type OdemeListesiPdfProps,
} from "@/lib/pdf/odeme-listesi-template";
import type { Database } from "@/lib/supabase/types";
import React from "react";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const turu = searchParams.get("turu");
    const durum = searchParams.get("durum");
    const cinsi = searchParams.get("cinsi");

    const supabase = await createClient();

    let query = supabase
      .from("odemeler")
      .select("tanimi, tutar, cinsi, tarih, turu, odeme_durum")
      .order("tarih", { ascending: false });

    if (turu) query = query.eq("turu", turu as Database["public"]["Enums"]["odeme_turu"]);
    if (durum) query = query.eq("odeme_durum", durum as Database["public"]["Enums"]["odeme_durumu"]);
    if (cinsi) query = query.eq("cinsi", cinsi as Database["public"]["Enums"]["para_birimi"]);

    const { data, error } = await query;
    if (error) throw error;

    const rows: OdemeRow[] = (data || []).map((r) => ({
      tanimi: r.tanimi,
      tutar: Number(r.tutar) || 0,
      cinsi: r.cinsi || "TL",
      tarih: r.tarih,
      turu: r.turu || "DİĞER",
      odeme_durum: r.odeme_durum || "BEKLİYOR",
    }));

    // Compute KPI values
    let bekleyenTl = 0;
    let bekleyenUsd = 0;
    let tamamlananTl = 0;
    let tamamlananUsd = 0;

    for (const r of rows) {
      if (r.odeme_durum === "BEKLİYOR") {
        if (r.cinsi === "USD") bekleyenUsd += r.tutar;
        else bekleyenTl += r.tutar;
      } else {
        if (r.cinsi === "USD") tamamlananUsd += r.tutar;
        else tamamlananTl += r.tutar;
      }
    }

    // Tür dağılımı
    const turMap = new Map<string, { adet: number; toplamTl: number }>();
    for (const r of rows) {
      const existing = turMap.get(r.turu) || { adet: 0, toplamTl: 0 };
      existing.adet += 1;
      if (r.cinsi === "TL") existing.toplamTl += r.tutar;
      turMap.set(r.turu, existing);
    }
    const turDagilimi = Array.from(turMap.entries())
      .map(([turu, v]) => ({ turu, adet: v.adet, toplamTl: v.toplamTl }))
      .sort((a, b) => b.toplamTl - a.toplamTl);

    // Filtre bilgisi
    const parts: string[] = [];
    if (turu) parts.push(`Tür: ${turu}`);
    if (durum) parts.push(`Durum: ${durum}`);
    if (cinsi) parts.push(`Cinsi: ${cinsi}`);

    const props: OdemeListesiPdfProps = {
      olusturmaTarihi: new Date().toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      toplamKayit: rows.length,
      bekleyenTl,
      bekleyenUsd,
      tamamlananTl,
      tamamlananUsd,
      rows,
      filtreBilgisi: parts.length > 0 ? parts.join(", ") : undefined,
      turDagilimi,
    };

    const element = React.createElement(OdemeListesiDocument, props);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    return new NextResponse(Buffer.from(pdfBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="odeme-listesi.pdf"`,
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
