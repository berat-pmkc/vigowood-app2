import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { NakitAkisClient } from "./components/nakit-akis-client";
import type { NakitDonem } from "@/lib/supabase/types";
import {
  NAKIT_GIRIS_TL_KOLONLAR,
  NAKIT_CIKIS_TL_KOLONLAR,
  NAKIT_CIKIS_USD_KOLONLAR,
} from "@/lib/constants";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    donem?: string;
  }>;
}

export const metadata: Metadata = { title: "Nakit Akış | VigoWood" };

export default async function NakitAkisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = params.tab === "giris-takip" ? "giris-takip" : "dashboard";

  // ---------- 1. Tüm dönemleri çek (selector için) ----------
  const { data: donemlerRaw } = await supabase
    .from("nakit_donemler")
    .select("id, donem_kodu")
    .order("donem_kodu", { ascending: false });

  const donemler = (donemlerRaw ?? []) as { id: string; donem_kodu: string }[];

  // ---------- Seçili dönem ----------
  const selectedDonemId = params.donem || donemler[0]?.id || "";

  if (!selectedDonemId || donemler.length === 0) {
    return (
      <div className="px-4 sm:px-6">
        <NakitAkisClient
          activeTab={activeTab}
          donemler={donemler}
          selectedDonemId=""
          hasData={false}
          kpiData={{ nakitTl: 0, nakitUsd: 0, toplamVarlik: 0, toplamBorc: 0, netPozisyon: 0 }}
          genelBakis={{
            varlikAcilisTl: 0, varlikAcilisUsd: 0, nakitGirisTl: 0, nakitGirisUsd: 0,
            nakitCikisTl: 0, nakitCikisUsd: 0, varlikTl: 0, varlikUsd: 0, yatirimTl: 0,
            toplamVarlikTl: 0, gayrinakitIslem: 0, toplamPiyasaBorcu: 0,
            toplamKkBorc: 0, toplamFinansalBorc: 0, kurBilgisi: 0,
          }}
          gelirYapisi={{ organikGelir: 0, dovizSatisi: 0, nakitKredi: 0, toplamTl: 0 }}
          satisKanallari={{ current: {} }}
          giderDagilimi={{ tlValues: {}, usdValues: {}, toplamTl: 0, toplamUsd: 0 }}
          borcYapisi={{ piyasaBorcu: 0, kkBorc: 0, finansalBorc: 0 }}
          trendData={[]}
          girisTakipData={[]}
        />
      </div>
    );
  }

  // ---------- 2. Seçili dönem verileri ----------
  const selectedDonemKodu = donemler.find((d) => d.id === selectedDonemId)?.donem_kodu;

  // Önceki dönem ID'sini bul
  const selectedIdx = donemler.findIndex((d) => d.id === selectedDonemId);
  const prevDonemId = selectedIdx >= 0 && selectedIdx < donemler.length - 1
    ? donemler[selectedIdx + 1].id
    : null;

  // Parallel queries
  const donemQuery = supabase
    .from("nakit_donemler")
    .select("*")
    .eq("id", selectedDonemId)
    .single();

  const girisQuery = supabase
    .from("nakit_girisler")
    .select("*")
    .eq("donem_id", selectedDonemId)
    .single();

  const cikisQuery = supabase
    .from("nakit_cikislar")
    .select("*")
    .eq("donem_id", selectedDonemId)
    .single();

  // Previous period queries
  const prevGirisQuery = prevDonemId
    ? supabase.from("nakit_girisler").select("*").eq("donem_id", prevDonemId).single()
    : Promise.resolve({ data: null, error: null });

  const prevDonemQuery = prevDonemId
    ? supabase.from("nakit_donemler").select("*").eq("id", prevDonemId).single()
    : Promise.resolve({ data: null, error: null });

  // Trend query — tüm dönemler
  const trendQuery = supabase
    .from("nakit_donemler")
    .select("donem_kodu, nakit_giris_tl, nakit_cikis_tl")
    .order("donem_kodu");

  // Giriş Takip
  const girisTakipQuery = supabase
    .from("nakit_giris_takip")
    .select("*")
    .order("tarih", { ascending: false });

  const [
    donemResult,
    girisResult,
    cikisResult,
    prevGirisResult,
    prevDonemResult,
    trendResult,
    girisTakipResult,
  ] = await Promise.all([
    donemQuery,
    girisQuery,
    cikisQuery,
    prevGirisQuery,
    prevDonemQuery,
    trendQuery,
    girisTakipQuery,
  ]);

  const donem = donemResult.data as NakitDonem | null;
  const giris = girisResult.data as Record<string, unknown> | null;
  const cikis = cikisResult.data as Record<string, unknown> | null;
  const prevGiris = prevGirisResult.data as Record<string, unknown> | null;
  const prevDonem = prevDonemResult.data as NakitDonem | null;

  if (!donem) {
    return (
      <div className="p-6">
        <p className="text-destructive">Dönem verisi bulunamadı.</p>
      </div>
    );
  }

  // ---------- Process data ----------
  const n = (v: unknown) => Number(v) || 0;

  const toplamBorc = n(donem.toplam_piyasa_borcu) + n(donem.toplam_kk_borc) + n(donem.toplam_finansal_borc);

  const kpiData = {
    nakitTl: n(donem.varlik_tl),
    nakitUsd: n(donem.varlik_usd),
    toplamVarlik: n(donem.toplam_varlik_tl),
    toplamBorc,
    netPozisyon: n(donem.toplam_varlik_tl) - toplamBorc,
  };

  const genelBakis = {
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
    kurBilgisi: n(donem.kur_bilgisi),
  };

  // Gelir Yapısı
  const organikGelir = giris
    ? n(giris.vigowood_com) + n(giris.trendyol) + n(giris.hepsiburada) +
      n(giris.amazon) + n(giris.diger_pazaryeri) + n(giris.has_mob)
    : 0;
  const dovizSatisi = giris ? n(giris.doviz_satisi) : 0;
  const nakitKredi = giris ? n(giris.nakit_kredi) : 0;
  const toplamTl = giris ? n(giris.toplam_tl) : 0;

  const gelirYapisi = { organikGelir, dovizSatisi, nakitKredi, toplamTl };

  // Satış Kanalları
  const currentChannels: Record<string, number> = {};
  const prevChannels: Record<string, number> = {};
  if (giris) {
    for (const col of NAKIT_GIRIS_TL_KOLONLAR) {
      currentChannels[col] = n(giris[col]);
    }
  }
  if (prevGiris) {
    for (const col of NAKIT_GIRIS_TL_KOLONLAR) {
      prevChannels[col] = n(prevGiris[col]);
    }
  }
  const satisKanallari = { current: currentChannels, prev: prevGiris ? prevChannels : undefined };

  // Gider Dağılımı
  const tlValues: Record<string, number> = {};
  const usdValues: Record<string, number> = {};
  if (cikis) {
    for (const col of NAKIT_CIKIS_TL_KOLONLAR) {
      tlValues[col] = n(cikis[col]);
    }
    for (const col of NAKIT_CIKIS_USD_KOLONLAR) {
      usdValues[col] = n(cikis[col]);
    }
  }
  const giderDagilimi = {
    tlValues,
    usdValues,
    toplamTl: cikis ? n(cikis.toplam_tl) : 0,
    toplamUsd: cikis ? n(cikis.toplam_yurtdisi_usd) : 0,
  };

  // Borç yapısı
  const borcYapisi = {
    piyasaBorcu: n(donem.toplam_piyasa_borcu),
    kkBorc: n(donem.toplam_kk_borc),
    finansalBorc: n(donem.toplam_finansal_borc),
  };

  // Trend
  const trendData = (trendResult.data ?? []).map(
    (r: { donem_kodu: string; nakit_giris_tl: number | null; nakit_cikis_tl: number | null }) => ({
      donemKodu: r.donem_kodu,
      girisTl: n(r.nakit_giris_tl),
      cikisTl: n(r.nakit_cikis_tl),
      netTl: n(r.nakit_giris_tl) - n(r.nakit_cikis_tl),
    })
  );

  // Giriş Takip
  const girisTakipData = (girisTakipResult.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    tanimi: r.tanimi as string,
    tutar: n(r.tutar),
    cinsi: r.cinsi as string | null,
    tarih: r.tarih as string | null,
    turu: r.turu as string | null,
    marka: r.marka as string | null,
    odeme_durum: r.odeme_durum as string | null,
  }));

  // Previous organik gelir (for alerts)
  const prevOrganikGelir = prevGiris
    ? n(prevGiris.vigowood_com) + n(prevGiris.trendyol) + n(prevGiris.hepsiburada) +
      n(prevGiris.amazon) + n(prevGiris.diger_pazaryeri) + n(prevGiris.has_mob)
    : undefined;

  return (
    <div className="px-4 sm:px-6">
      <NakitAkisClient
        activeTab={activeTab}
        donemler={donemler}
        selectedDonemId={selectedDonemId}
        hasData={true}
        kpiData={kpiData}
        genelBakis={genelBakis}
        gelirYapisi={gelirYapisi}
        satisKanallari={satisKanallari}
        giderDagilimi={giderDagilimi}
        borcYapisi={borcYapisi}
        trendData={trendData}
        girisTakipData={girisTakipData}
        prevOrganikGelir={prevOrganikGelir}
      />
    </div>
  );
}
