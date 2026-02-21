import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { PackingListDocument } from "@/lib/pdf/packing-list-template";
import type { PackingListData, PackingListItem, PLExporterConfig, PLBuyerConfig, PLDispatchConfig, PLSignatoryConfig, PLContactConfig } from "@/lib/pdf/packing-list-template";
import type { SevkiyatItemRow, SevkiyatFirmaRow } from "@/app/(dashboard)/sevkiyat/actions";
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
      ihracatci_firma_id: number | null;
      alici_firma_id: number | null;
      banka_firma_id: number | null;
    };

    // Fetch firma data from DB if available
    let plExporter: PLExporterConfig | undefined;
    let plBuyer: PLBuyerConfig | undefined;
    let plDispatch: PLDispatchConfig | undefined;
    let plSignatory: PLSignatoryConfig | undefined;
    let plContact: PLContactConfig | undefined;

    // Fetch all active firms (includes ihracatci, alici, imzalayan, contact)
    const { data: allFirma } = await supabase
      .from("sevkiyat_firmalar")
      .select("*")
      .eq("aktif", true);

    const firmaRows = ((allFirma ?? []) as SevkiyatFirmaRow[]);
    const firmaById = new Map(firmaRows.map(f => [f.id, f]));

    // İhracatçı
    const ihracatci = sev.ihracatci_firma_id ? firmaById.get(sev.ihracatci_firma_id) : null;
    if (ihracatci) {
      plExporter = {
        companyName: ihracatci.firma_adi ?? ihracatci.profil_adi,
        address1: ihracatci.adres_satir1 ?? "",
        address2: ihracatci.adres_satir2 ?? "",
        phone: ihracatci.telefon ?? "",
      };
    }

    // Alıcı
    const alici = sev.alici_firma_id ? firmaById.get(sev.alici_firma_id) : null;
    if (alici) {
      plBuyer = {
        name1: alici.firma_adi ?? alici.profil_adi,
        name2: "",
        vat: alici.vat_no ?? "",
        address: [alici.adres_satir1, alici.adres_satir2].filter(Boolean).join(", "),
      };
      // Dispatch from alici's sevk_yontemi
      if (alici.sevk_yontemi) {
        plDispatch = {
          name: alici.country_code ?? sev.country_code ?? "",
          method: alici.sevk_yontemi,
        };
      }
    }

    // İmzalayan
    const imzalayan = firmaRows.find(f => f.firma_tipi === "imzalayan" && f.varsayilan);
    if (imzalayan) {
      plSignatory = {
        placeOfIssue: imzalayan.imza_yeri ?? "",
        company: imzalayan.firma_adi ?? imzalayan.profil_adi,
        authorizedName: imzalayan.yetkili_adi ?? "",
      };
    }

    // Contact
    const contact = firmaRows.find(f => f.firma_tipi === "contact" && f.varsayilan);
    if (contact) {
      plContact = {
        name: contact.yetkili_adi ?? contact.profil_adi,
        phone: contact.telefon ?? "",
        email: contact.email ?? "",
      };
    }

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
      exporterConfig: plExporter,
      buyerConfig: plBuyer,
      dispatchConfig: plDispatch,
      signatoryConfig: plSignatory,
      contactConfig: plContact,
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
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json(
      { error: `PDF oluşturulurken hata oluştu: ${msg}` },
      { status: 500 }
    );
  }
}
