/**
 * Yükleme planı raporu — kendi kendine yeten HTML sayfası.
 *
 * Kayıtlı bir planı (yukleme_planlari) alıp container-packer'ın rapor
 * üreticisinden geçirir ve text/html döner. Planlama ekranındaki "Raporu Aç"
 * butonu bu adresi yeni sekmede açar; sayfa yazdırılabilir ve tek dosya
 * olarak kaydedilebilir (dış bağımlılığı yok).
 *
 * ERİŞİM — bilinçli olarak dar tutuldu:
 *   1. Giriş yapmış olmak şart (oturum yoksa /login'e gider)
 *   2. Sevkiyat modülü rolü şart
 *   3. Planı YALNIZCA oluşturan kişi veya yönetici açabilir
 *
 * Token'lı "linki bilen herkes açar" tarzı bir paylaşım YOK. Rapor ürün
 * ölçülerini, adetleri ve sevkiyat detayını içerdiği için bu istenmedi.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import {
  renderReportHtml,
  type Block,
  type ContainerDims,
  type PackResult,
  type ProductInput,
} from "@/lib/container-packer";

/**
 * Kayıtta tutulan blok.
 *
 * DİKKAT: Bu, motorun (container-packer) Block tipi DEĞİL. Planlama ekranı
 * blokları uygulamanın Blok tipiyle saklıyor — ürün alanı `sku`, adet alanı
 * `n`. Motor ise `productId` / `count` bekliyor. Bu dönüşüm atlandığında
 * renderReportHtml undefined alanlarla çalışıp 500 veriyordu.
 */
interface KayitliBlok {
  sku?: string; productId?: string;
  n?: number; count?: number;
  x: number; y: number; z: number;
  dx: number; dy: number; dz: number;
  l: number; w: number; h: number;
  nx: number; ny: number; nz: number;
  bonus?: boolean;
}

/** Kayıtta tutulan ürün girdisi */
interface KayitliUrun {
  sku: string;
  ad?: string | null;
  boy: number;
  en: number;
  yuk: number;
  renk?: string;
  hedef?: number;
}

function hataSayfasi(baslik: string, mesaj: string, kod: number) {
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${baslik}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:'Segoe UI',system-ui,sans-serif;background:#f0ede1;color:#474237}
.k{background:#fff;border:1px solid #a99c7d;border-radius:12px;padding:32px 40px;max-width:440px}
h1{margin:0 0 8px;font-size:19px}p{margin:0;color:#5e5747;font-size:14px;line-height:1.6}</style>
</head><body><div class="k"><h1>${baslik}</h1><p>${mesaj}</p></div></body></html>`;
  return new NextResponse(html, {
    status: kod,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=/sevkiyat/planlama/rapor/${id}`, _req.url),
    );
  }
  if (!SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    return hataSayfasi("Yetkiniz yok", "Bu raporu görüntüleme yetkiniz bulunmuyor.", 403);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("yukleme_planlari")
    .select("id, ad, konteyner_tipi, ic_uzunluk, ic_genislik, ic_yukseklik, girdi, sonuc, olusturan, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return hataSayfasi("Hata", "Plan okunamadı.", 500);
  if (!data) return hataSayfasi("Bulunamadı", "Bu plan silinmiş veya hiç var olmamış.", 404);

  // Planı yalnızca sahibi veya yönetici görebilir
  const sahibi = data.olusturan === user.user_id;
  const yonetici = user.role === "Yönetici";
  if (!sahibi && !yonetici) {
    return hataSayfasi(
      "Yetkiniz yok",
      "Bu planı yalnızca oluşturan kişi veya yönetici görüntüleyebilir.",
      403,
    );
  }

  const girdi = (data.girdi ?? {}) as { urunler?: KayitliUrun[] };
  const sonuc = (data.sonuc ?? {}) as {
    bloklar?: KayitliBlok[];
    yuklenen?: Record<string, number>;
    eksik?: Record<string, number>;
    toplamKoli?: number;
    toplamHacim?: number;
    kullanilanBoy?: number;
  };

  const urunler = girdi.urunler ?? [];
  const bloklar = sonuc.bloklar ?? [];
  if (urunler.length === 0 || bloklar.length === 0) {
    return hataSayfasi(
      "Rapor üretilemedi",
      "Bu plan kaydı rapor için gereken ayrıntıyı içermiyor. Planı yeniden oluşturup kaydedin.",
      422,
    );
  }

  const container: ContainerDims = {
    length: Number(data.ic_uzunluk),
    width: Number(data.ic_genislik),
    height: Number(data.ic_yukseklik),
  };

  const products: ProductInput[] = urunler.map((u) => ({
    id: u.sku,
    name: u.ad ?? u.sku,
    dims: [u.boy, u.en, u.yuk] as [number, number, number],
    qty: u.hedef ?? sonuc.yuklenen?.[u.sku] ?? 0,
    color: u.renk,
  }));

  // Uygulama şemasından motor şemasına çevir (sku→productId, n→count).
  // Her iki ad da kabul ediliyor ki eski kayıtlar da açılabilsin.
  const motorBloklar: Block[] = bloklar.map((b) => ({
    productId: b.productId ?? b.sku ?? "?",
    x: b.x, y: b.y, z: b.z,
    dx: b.dx, dy: b.dy, dz: b.dz,
    l: b.l, w: b.w, h: b.h,
    nx: b.nx, ny: b.ny, nz: b.nz,
    count: b.count ?? b.n ?? 0,
    bonus: b.bonus,
  }));

  // sonuc.toplamHacim m³ olarak kaydediliyor; renderReportHtml cm³ bekliyor
  const hacim = sonuc.toplamHacim !== undefined
    ? sonuc.toplamHacim * 1e6
    : motorBloklar.reduce((t, b) => t + b.count * b.l * b.w * b.h, 0);
  const kontHacim = container.length * container.width * container.height;

  const plan: PackResult = {
    container,
    blocks: motorBloklar,
    placed: sonuc.yuklenen ?? {},
    shortfall: sonuc.eksik ?? {},
    totalUnits: sonuc.toplamKoli ?? motorBloklar.reduce((t, b) => t + b.count, 0),
    volume: hacim,
    fillRatio: kontHacim > 0 ? hacim / kontHacim : 0,
    usedLength: sonuc.kullanilanBoy
      ?? motorBloklar.reduce((m, b) => Math.max(m, b.x + b.dx), 0),
    iterations: 0,
  };

  const tarih = new Date(data.created_at).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  let html: string;
  try {
    html = renderReportHtml(plan, products, {
      title: `${data.ad} — ${data.konteyner_tipi} · ${tarih}`,
      targets: Object.fromEntries(urunler.map((u) => [u.sku, u.hedef ?? 0])),
    });
  } catch (e) {
    // Ham 500 yerine ne olduğu anlaşılan bir sayfa dönsün
    console.error("[yükleme raporu] render hatası", { planId: id, hata: e });
    return hataSayfasi(
      "Rapor çizilemedi",
      `Plan okundu ama rapor üretilirken hata oluştu: ${
        e instanceof Error ? e.message : "bilinmeyen hata"
      }`,
      500,
    );
  }

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Plan verisi kişiye özel — ara katmanlarda önbelleklenmesin
      "cache-control": "private, no-store",
    },
  });
}
