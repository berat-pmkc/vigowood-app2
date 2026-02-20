import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { ProformaDocument } from "@/lib/pdf/proforma-template";
import type { ProformaData, ProformaItem } from "@/lib/pdf/proforma-template";
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
      liman: string | null;
      konteyner_no: string | null;
      teslimat_tipi: string | null;
    };

    // Items
    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", id)
      .order("created_at");

    const itemRows = (items ?? []) as SevkiyatItemRow[];

    // Fiyat bilgileri
    const fiyatlar: Record<string, { urun_adi_en: string; gtip: string; birim_fiyat: number }> = {};
    if (sev.country_code) {
      const { data: fData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("sku, urun_adi_en, gtip, birim_fiyat")
        .eq("country_code", sev.country_code);

      if (fData) {
        for (const row of fData as { sku: string; urun_adi_en: string | null; gtip: string | null; birim_fiyat: number }[]) {
          fiyatlar[row.sku] = {
            urun_adi_en: row.urun_adi_en ?? row.sku,
            gtip: row.gtip ?? "",
            birim_fiyat: row.birim_fiyat,
          };
        }
      }
    }

    // Proforma veri hazırla
    const proformaItems: ProformaItem[] = itemRows.map((item) => {
      const fiyat = fiyatlar[item.sku] ?? { urun_adi_en: item.urun_adi ?? item.sku, gtip: "", birim_fiyat: 0 };
      return {
        sku: item.sku,
        urun_adi_en: fiyat.urun_adi_en,
        gtip: fiyat.gtip,
        palet_sayisi: item.palet_sayisi ?? 0,
        toplam_koli: item.toplam_koli ?? 0,
        qty: item.qty ?? 0,
        agirlik: item.agirlik ?? 0,
        birim_fiyat: fiyat.birim_fiyat,
        toplam_fiyat: (item.qty ?? 0) * fiyat.birim_fiyat,
      };
    });

    const proformaData: ProformaData = {
      sevkiyat_id: sev.sevkiyat_id,
      country_code: sev.country_code ?? "DE",
      shipment_number: sev.shipment_number ?? 0,
      sevk_tarihi: sev.sevk_tarihi,
      liman: sev.liman,
      konteyner_no: sev.konteyner_no,
      teslimat_tipi: sev.teslimat_tipi,
      items: proformaItems,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(ProformaDocument, { data: proformaData }) as any;
    const buffer = await renderToBuffer(element);

    const fileName = `Proforma_${id}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Proforma PDF error:", error);
    return NextResponse.json(
      { error: "PDF oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
