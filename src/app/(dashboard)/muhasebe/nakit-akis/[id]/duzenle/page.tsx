import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDonemById } from "../../actions";
import { DonemForm } from "../../yeni/components/donem-form";
import {
  NAKIT_GIRIS_TL_KOLONLAR,
  NAKIT_GIRIS_USD_KOLONLAR,
  NAKIT_CIKIS_TL_KOLONLAR,
  NAKIT_CIKIS_USD_KOLONLAR,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Dönem Düzenle | Nakit Akış" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DuzenleDonemPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getDonemById(id);

  if (!data) {
    notFound();
  }

  const { donem, giris, cikis } = data;
  const n = (v: unknown) => Number(v) || 0;

  // Girişleri record'a çevir
  const girisler: Record<string, number> = {};
  if (giris) {
    for (const col of [...NAKIT_GIRIS_TL_KOLONLAR, ...NAKIT_GIRIS_USD_KOLONLAR]) {
      girisler[col] = n((giris as Record<string, unknown>)[col]);
    }
  }

  // Çıkışları record'a çevir
  const cikislar: Record<string, number> = {};
  if (cikis) {
    for (const col of [...NAKIT_CIKIS_TL_KOLONLAR, ...NAKIT_CIKIS_USD_KOLONLAR]) {
      cikislar[col] = n((cikis as Record<string, unknown>)[col]);
    }
  }

  const initialData = {
    id: donem.id,
    donemKodu: donem.donem_kodu,
    baslangicTarihi: donem.baslangic_tarihi,
    bitisTarihi: donem.bitis_tarihi,
    kurBilgisi: n(donem.kur_bilgisi),
    varlikAcilisTl: n(donem.varlik_acilis_tl),
    varlikAcilisUsd: n(donem.varlik_acilis_usd),
    varlikTl: n(donem.varlik_tl),
    varlikUsd: n(donem.varlik_usd),
    yatirimTl: n(donem.yatirim_tl),
    gayrinakitIslem: n(donem.gayrinakit_islem),
    toplamPiyasaBorcu: n(donem.toplam_piyasa_borcu),
    toplamKkBorc: n(donem.toplam_kk_borc),
    toplamFinansalBorc: n(donem.toplam_finansal_borc),
    girisler,
    cikislar,
  };

  return (
    <div className="px-4 sm:px-6 pb-20 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dönem Düzenle</h1>
        <p className="text-sm text-muted-foreground">
          {donem.donem_kodu} dönem bilgilerini güncelleyin.
        </p>
      </div>
      <DonemForm initialData={initialData} />
    </div>
  );
}
