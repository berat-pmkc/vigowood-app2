import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { PackingListDocument } from "@/lib/pdf/packing-list-template";
import type { PackingListData, PackingListItem } from "@/lib/pdf/packing-list-template";
import type { SevkiyatItemRow } from "@/app/(dashboard)/sevkiyat/actions";
import React from "react";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Sevkiyat bilgileri
    const { data: sevkData, error: sevkErr } = await supabase
      .from("sevkiyat")
      .select("*")
      .eq("sevkiyat_id", id)
      .single();

    if (sevkErr || !sevkData) {
      return NextResponse.json({ error: "Sevkiyat bulunamadı" }, { status: 404 });
    }

    const sev = sevkData as {
      sevkiyat_id: string;
      country_code: string | null;
      shipment_number: number | null;
      sevk_tarihi: string | null;
      konteyner_no: string | null;
    };

    // Items
    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", id)
      .order("created_at");

    const itemRows = (items ?? []) as SevkiyatItemRow[];

    // İngilizce ürün isimlerini getir
    const productNames: Record<string, string> = {};
    if (sev.country_code) {
      const { data: fData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("sku, urun_adi_en")
        .eq("country_code", sev.country_code);

      if (fData) {
        for (const row of fData as { sku: string; urun_adi_en: string | null }[]) {
          if (row.urun_adi_en) productNames[row.sku] = row.urun_adi_en;
        }
      }
    }

    // Packing list veri hazırla
    const plItems: PackingListItem[] = itemRows.map((item) => ({
      sku: item.sku,
      urun_adi_en: productNames[item.sku] ?? item.urun_adi ?? item.sku,
      palet_boyut: item.palet_boyut ?? "80x120",
      palet_yukseklik: item.palet_yukseklik ?? 100,
      palet_sayisi: item.palet_sayisi ?? 0,
      qty: item.qty ?? 0,
      toplam_koli: item.toplam_koli ?? 0,
      koli_agirlik: item.koli_agirlik ?? 0,
      agirlik: item.agirlik ?? 0,
      hacim: item.hacim ?? 0,
    }));

    const packingListData: PackingListData = {
      sevkiyat_id: sev.sevkiyat_id,
      country_code: sev.country_code ?? "DE",
      shipment_number: sev.shipment_number ?? 0,
      sevk_tarihi: sev.sevk_tarihi,
      konteyner_no: sev.konteyner_no,
      items: plItems,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(PackingListDocument, { data: packingListData }) as any;
    const buffer = await renderToBuffer(element);

    const fileName = `PL-${id}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Packing List PDF error:", error);
    return NextResponse.json(
      { error: "PDF oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
