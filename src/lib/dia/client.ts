import "server-only";

/**
 * DİA Web Servis API istemcisi (JSON, v3).
 *
 * DİA'nın servisi klasik REST değil: tek bir uç noktaya, gövdesinde servis
 * adının anahtar olduğu bir JSON gönderiliyor. Modüller ayrı adreslerde:
 *   https://{uyekodu}.ws.dia.com.tr/api/v3/sis/json   → login/logout, sistem
 *   https://{uyekodu}.ws.dia.com.tr/api/v3/scf/json   → stok/cari/fatura
 *
 * Önemli davranışlar:
 *  - Oturum 1 saat sonra düşer; her çağrı süreyi sıfırlar. Bu yüzden
 *    session_id modül seviyesinde önbellekleniyor (Vercel'de sıcak lambda
 *    boyunca yaşar, soğuk başlangıçta yeniden login olur — ikisi de doğru).
 *  - login/logout kontör harcamaz, diğer her çağrı 0,0125 kontör harcar.
 *    Bu yüzden gereksiz login atmamak önemli.
 *  - Kullanıcıda "İzin Verilen IP'ler" tanımlıysa Vercel'in dinamik IP'leri
 *    reddedilir. O alanın BOŞ olması gerekiyor.
 */

export type DiaModul = "sis" | "scf" | "muh" | "ure" | "efa";

export interface DiaCevap<T = unknown> {
  code: string;
  msg?: string;
  result?: T;
}

export class DiaHata extends Error {
  constructor(
    message: string,
    readonly kod?: string,
  ) {
    super(message);
    this.name = "DiaHata";
  }
}

// ─── Yapılandırma ───────────────────────────────────────────────

export interface DiaAyar {
  uyeKodu: string;
  kullanici: string;
  sifre: string;
  apiKey?: string;
  firmaKodu: number;
  donemKodu: number;
}

/** Ortam değişkenlerinden ayarları okur. Eksikse null döner (fırlatmaz). */
export function diaAyarOku(): DiaAyar | null {
  const uyeKodu = process.env.DIA_UYE_KODU;
  const kullanici = process.env.DIA_KULLANICI;
  const sifre = process.env.DIA_SIFRE;
  const firmaKodu = Number(process.env.DIA_FIRMA_KODU);
  const donemKodu = Number(process.env.DIA_DONEM_KODU);

  if (!uyeKodu || !kullanici || !sifre || !Number.isFinite(firmaKodu)) {
    return null;
  }

  return {
    uyeKodu,
    kullanici,
    sifre,
    apiKey: process.env.DIA_API_KEY || undefined,
    firmaKodu,
    // Dönem gönderilmezse/0 ise DİA öntanımlı dönemi kullanır — güvenli varsayılan
    donemKodu: Number.isFinite(donemKodu) ? donemKodu : 0,
  };
}

function adres(uyeKodu: string, modul: DiaModul): string {
  return `https://${uyeKodu}.ws.dia.com.tr/api/v3/${modul}/json`;
}

// ─── Alt seviye çağrı ───────────────────────────────────────────

const ZAMAN_ASIMI_MS = 60_000;

async function ham<T>(
  ayar: DiaAyar,
  modul: DiaModul,
  govde: Record<string, unknown>,
): Promise<DiaCevap<T>> {
  const ctrl = new AbortController();
  const zamanlayici = setTimeout(() => ctrl.abort(), ZAMAN_ASIMI_MS);

  try {
    const res = await fetch(adres(ayar.uyeKodu, modul), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
      signal: ctrl.signal,
      cache: "no-store",
    });

    const metin = await res.text();

    if (!res.ok) {
      throw new DiaHata(
        `DİA HTTP ${res.status}: ${metin.slice(0, 300)}`,
        String(res.status),
      );
    }

    try {
      return JSON.parse(metin) as DiaCevap<T>;
    } catch {
      throw new DiaHata(`DİA geçersiz JSON döndü: ${metin.slice(0, 300)}`);
    }
  } catch (e) {
    if (e instanceof DiaHata) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new DiaHata("DİA sunucusu zaman aşımına uğradı (60 sn)");
    }
    throw new DiaHata(e instanceof Error ? e.message : "DİA bağlantı hatası");
  } finally {
    clearTimeout(zamanlayici);
  }
}

// ─── Oturum ─────────────────────────────────────────────────────

/** Oturum 1 saat geçerli; 50 dk sonra kendimiz yenileyip sınıra dayanmıyoruz. */
const OTURUM_OMRU_MS = 50 * 60 * 1000;

let onbellek: { sessionId: string; sonKullanim: number; uyeKodu: string } | null = null;

export async function diaLogin(ayar: DiaAyar, zorla = false): Promise<string> {
  const simdi = Date.now();

  if (
    !zorla &&
    onbellek &&
    onbellek.uyeKodu === ayar.uyeKodu &&
    simdi - onbellek.sonKullanim < OTURUM_OMRU_MS
  ) {
    onbellek.sonKullanim = simdi;
    return onbellek.sessionId;
  }

  const govde: Record<string, unknown> = {
    login: {
      username: ayar.kullanici,
      password: ayar.sifre,
      disconnect_same_user: "True",
      lang: "tr",
      ...(ayar.apiKey ? { params: { apikey: ayar.apiKey } } : {}),
    },
  };

  const cevap = await ham<never>(ayar, "sis", govde);

  if (cevap.code !== "200" || !cevap.msg) {
    throw new DiaHata(
      `DİA girişi başarısız (${cevap.code}): ${cevap.msg ?? "bilinmeyen hata"}`,
      cevap.code,
    );
  }

  onbellek = { sessionId: cevap.msg, sonKullanim: simdi, uyeKodu: ayar.uyeKodu };
  return cevap.msg;
}

export async function diaLogout(ayar: DiaAyar): Promise<void> {
  if (!onbellek) return;
  const sid = onbellek.sessionId;
  onbellek = null;
  try {
    await ham(ayar, "sis", { logout: { session_id: sid } });
  } catch {
    // Oturum kapatma başarısız olsa da akışı bozmuyoruz; 1 saatte kendi düşer.
  }
}

/**
 * Servis çağrısı. session_id / firma_kodu / donem_kodu otomatik eklenir.
 * Oturum düşmüşse (401 / NOSESSION) bir kez yeniden login olup tekrar dener.
 */
export async function diaCagir<T = unknown>(
  ayar: DiaAyar,
  modul: DiaModul,
  servis: string,
  parametreler: Record<string, unknown> = {},
): Promise<T> {
  const calistir = async (sessionId: string) => {
    const govde = {
      [servis]: {
        session_id: sessionId,
        firma_kodu: ayar.firmaKodu,
        donem_kodu: ayar.donemKodu,
        ...parametreler,
      },
    };
    return ham<T>(ayar, modul, govde);
  };

  let cevap = await calistir(await diaLogin(ayar));

  const oturumDustu =
    cevap.code === "401" ||
    (typeof cevap.msg === "string" && /SESSION|OTURUM/i.test(cevap.msg));

  if (oturumDustu) {
    cevap = await calistir(await diaLogin(ayar, true));
  }

  if (cevap.code !== "200") {
    throw new DiaHata(
      `${servis} başarısız (${cevap.code}): ${cevap.msg ?? "açıklama yok"}`,
      cevap.code,
    );
  }

  return (cevap.result ?? []) as T;
}

// ─── Listeleme yardımcısı ───────────────────────────────────────

export interface DiaFiltre {
  field: string;
  operator?: "<" | ">" | "<=" | ">=" | "!" | "=" | "IN" | "NOT IN";
  value: string | number;
}

/**
 * Sayfalayarak tüm kayıtları çeker.
 *
 * DİA dokümanı offset yerine `_key` üzerinden ilerlemeyi öneriyor: offset
 * büyüdükçe sorgu yavaşlıyor, `_key > sonKey` filtresi ise sabit hızda.
 * Her sayfa 0,0125 kontör; sayfa boyutu 500 seçildi (10.000 satır ≈ 0,25 kontör).
 */
export async function diaListele<T extends { _key?: string | number }>(
  ayar: DiaAyar,
  modul: DiaModul,
  servis: string,
  secenek: {
    filters?: DiaFiltre[];
    params?: Record<string, unknown>;
    sayfaBoyutu?: number;
    enFazlaSayfa?: number;
  } = {},
): Promise<T[]> {
  const sayfaBoyutu = secenek.sayfaBoyutu ?? 500;
  const enFazlaSayfa = secenek.enFazlaSayfa ?? 60;

  const tumu: T[] = [];
  let sonKey: string | number = 0;

  for (let sayfa = 0; sayfa < enFazlaSayfa; sayfa++) {
    const sonuc: T[] = await diaCagir<T[]>(ayar, modul, servis, {
      filters: [
        ...(secenek.filters ?? []),
        { field: "_key", operator: ">", value: sonKey },
      ],
      sorts: [{ field: "_key", sorttype: "ASC" }],
      params: secenek.params ?? "",
      limit: sayfaBoyutu,
      offset: 0,
    });

    if (!Array.isArray(sonuc) || sonuc.length === 0) break;

    tumu.push(...sonuc);

    if (sonuc.length < sayfaBoyutu) break;

    const yeniKey: string | number | undefined = sonuc[sonuc.length - 1]?._key;
    if (yeniKey === undefined || yeniKey === sonKey) break; // ilerlemiyorsa sonsuz döngüye girme
    sonKey = yeniKey;
  }

  return tumu;
}
