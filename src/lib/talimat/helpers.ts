/**
 * İş talimatı / talep saf yardımcıları (istemci + sunucu). Yan etkisi yoktur.
 */
import { TALEP_SERBEST_DAKIKA, HIZLI_MIKTAR_SAYFALARI } from "./constants";
import type { TalimatHataKodu, TalimatSatir, TalimatSatirFiltre } from "./types";

/** RPC hata mesajından kod çıkarır (ör. "ARDISIK_SKU: ...") ve kodu mesajdan ayıklar */
export function parseRpcHata(message: string): { kod?: TalimatHataKodu; mesaj: string } {
  const m = /^(ARDISIK_SKU|SIRA_DOLU|PLAN_PASIF):\s*([\s\S]*)$/.exec(message.trim());
  if (m) return { kod: m[1] as TalimatHataKodu, mesaj: m[2] };
  if (/yetki/i.test(message)) return { kod: "YETKI", mesaj: message };
  return { mesaj: message };
}

/** Hızlı miktar sayfaları: 0 -> [50..250], 1 -> [300..500] ("daha fazla") */
export function hizliMiktarlar(sayfa = 0): readonly number[] {
  return HIZLI_MIKTAR_SAYFALARI[Math.min(Math.max(sayfa, 0), HIZLI_MIKTAR_SAYFALARI.length - 1)];
}

/** Talebi açan için serbest (kayıtsız) düzenleme penceresi hâlâ açık mı */
export function talepSerbestMi(createdAt: string | Date, simdi: Date = new Date()): boolean {
  const t = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return simdi.getTime() - t.getTime() <= TALEP_SERBEST_DAKIKA * 60_000;
}

/** Kalan serbest süre (saniye, 0'dan küçük olmaz) */
export function talepSerbestKalanSn(createdAt: string | Date, simdi: Date = new Date()): number {
  const t = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Math.max(0, Math.ceil((t.getTime() + TALEP_SERBEST_DAKIKA * 60_000 - simdi.getTime()) / 1000));
}

/**
 * Talep açarken stok uyarısı: stok istenen miktardan fazla/eşitse
 * ("Stokta 500 var, yine de talep ediyor musunuz?"). Hedef depo seçiliyse o depo stoğu esas alınır.
 */
export function stokUyarisiMetni(
  istenen: number | null | undefined,
  toplamStok: number,
  depoStok: number | null,
  depoAdi?: string | null,
): string | null {
  if (!istenen || istenen <= 0) return null;
  const kullanilan = depoStok != null ? depoStok : toplamStok;
  if (kullanilan < istenen) return null;
  const nerede = depoStok != null ? `${depoAdi ?? "Hedef depoda"}` : "Stokta";
  return `${nerede} ${kullanilan} var, yine de talep ediyor musunuz?`;
}

/** Liste "güncel" rozeti durumu (gün bazlı) */
export function guncellikDurumu(
  bitis: string | null | undefined,
  bugun: string = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }),
): { guncel: boolean; bitis: string | null } {
  return { guncel: !!bitis && bitis >= bugun, bitis: bitis ?? null };
}

/** Pazartesi (YYYY-MM-DD) — verilen tarihin haftası */
export function haftaBaslangici(tarih: Date | string = new Date()): string {
  const d = typeof tarih === "string" ? new Date(`${tarih}T12:00:00`) : new Date(tarih);
  const gun = (d.getDay() + 6) % 7; // Pzt=0
  d.setDate(d.getDate() - gun);
  return d.toLocaleDateString("sv-SE");
}

/** Haftaya gün ekle (YYYY-MM-DD) */
export function gunEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T12:00:00`);
  d.setDate(d.getDate() + gun);
  return d.toLocaleDateString("sv-SE");
}

/** Ürünsüz (ve plakasız) satır: personel eklendi ama iş henüz seçilmedi; tablette görünmez, özetlerde sayılmaz */
export function satirBos(s: Pick<TalimatSatir, "sku" | "plaka_id">): boolean {
  return !s.sku && !s.plaka_id;
}

/**
 * İstemci tarafı filtre (sunucu filtreleriyle aynı mantık; çevrimdışı/realtime listelerde kullanılır).
 * oncelik1SeansBaslamamis: sira=1 ve (bugun|hafta) seansı yok.
 */
export function satirFiltrele(satirlar: TalimatSatir[], f: TalimatSatirFiltre): TalimatSatir[] {
  const q = f.arama?.trim().toLocaleLowerCase("tr");
  return satirlar.filter((s) => {
    if (f.personelId && s.personel_id !== f.personelId) return false;
    if (f.istasyon && s.etkin_istasyon !== f.istasyon) return false;
    if (q) {
      const hay = `${s.sku ?? ""} ${s.urun_adi ?? ""} ${s.plaka_id ?? ""}`.toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }
    if (f.sadeceOncelik1 && (s.sira !== 1 || satirBos(s))) return false;
    if (f.oncelik1SeansBaslamamis) {
      if (s.sira !== 1 || satirBos(s)) return false;
      const basladi = (f.seansKapsami ?? "bugun") === "hafta" ? s.hafta_seans_var : s.bugun_seans_var;
      if (basladi) return false;
    }
    if (f.sadeceDegisen && !s.degisti) return false;
    if (f.sadeceOnaylamayan && !s.onay_bekliyor) return false;
    if (f.sadecePasif && !s.etkin_pasif) return false;
    if (f.sadeceTamamlanan && s.etkin_durum !== "tamamlandi") return false;
    if (f.pasifGizle && s.etkin_pasif) return false;
    return true;
  });
}

/** Satırın ilerleme yüzdesi (0-100; istenen yoksa null) */
export function ilerlemeYuzdesi(s: Pick<TalimatSatir, "istenen_miktar" | "uretilen">): number | null {
  if (!s.istenen_miktar) return null;
  return Math.min(100, Math.round((s.uretilen / s.istenen_miktar) * 100));
}

/** Satırları personele göre grupla (sıraya göre) */
export function personeleGoreGrupla(satirlar: TalimatSatir[]): Map<string, TalimatSatir[]> {
  const harita = new Map<string, TalimatSatir[]>();
  for (const s of satirlar) {
    const liste = harita.get(s.personel_id) ?? [];
    liste.push(s);
    harita.set(s.personel_id, liste);
  }
  for (const liste of harita.values()) liste.sort((a, b) => a.sira - b.sira);
  return harita;
}

/**
 * users.station -> talimat istasyonu (SQL: talimat_istasyon_esle ile aynı).
 * Kesim/Montaj/Paketleme (+ " Hattı") eşlenir; Temizlik, Kutu, Ofis, Yönetim vb. -> null.
 */
export function istasyonEsle(station: string | null | undefined): "kesim" | "montaj" | "paketleme" | null {
  switch (station) {
    case "Kesim":
    case "Kesim Hattı":
      return "kesim";
    case "Montaj":
    case "Montaj Hattı":
      return "montaj";
    case "Paketleme":
    case "Paketleme Hattı":
      return "paketleme";
    default:
      return null;
  }
}
