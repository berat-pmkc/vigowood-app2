import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FINANCE_ROLES } from "@/lib/constants";
import {
  OdemelerTakvimDocument,
  type TakvimOdemeRow,
  type OdemelerTakvimPdfProps,
} from "@/lib/pdf/odemeler-takvim-template";
import React from "react";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month"); // 0-indexed

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth();

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json({ error: "Geçersiz yıl/ay parametresi" }, { status: 400 });
    }

    // Fetch odemeler for the month
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("odemeler")
      .select("tanimi, tutar, cinsi, tarih, turu, odeme_durum")
      .gte("tarih", startDate)
      .lte("tarih", endDate)
      .order("tarih", { ascending: true });

    if (error) throw error;

    const rows: TakvimOdemeRow[] = (data || []).map((r) => ({
      tanimi: r.tanimi,
      tutar: Number(r.tutar) || 0,
      cinsi: r.cinsi || "TL",
      tarih: r.tarih || startDate,
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

    // Tur dagilimi
    const turMap = new Map<string, { adet: number; toplamTl: number; toplamUsd: number }>();
    for (const r of rows) {
      const existing = turMap.get(r.turu) || { adet: 0, toplamTl: 0, toplamUsd: 0 };
      existing.adet += 1;
      if (r.cinsi === "USD") existing.toplamUsd += r.tutar;
      else existing.toplamTl += r.tutar;
      turMap.set(r.turu, existing);
    }
    const turDagilimi = Array.from(turMap.entries())
      .map(([turu, v]) => ({ turu, adet: v.adet, toplamTl: v.toplamTl, toplamUsd: v.toplamUsd }))
      .sort((a, b) => (b.toplamTl + b.toplamUsd * 36) - (a.toplamTl + a.toplamUsd * 36));

    const props: OdemelerTakvimPdfProps = {
      year,
      month,
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
      turDagilimi,
    };

    const element = React.createElement(OdemelerTakvimDocument, props);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    const AY_ISIMLERI_FILE = [
      "ocak", "subat", "mart", "nisan", "mayis", "haziran",
      "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik",
    ];

    return new NextResponse(Buffer.from(pdfBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="odeme-takvimi-${AY_ISIMLERI_FILE[month]}-${year}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Takvim PDF generation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF oluşturma hatası" },
      { status: 500 },
    );
  }
}
