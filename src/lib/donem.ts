/**
 * Özet dönem kodları.
 *
 * Etiketin kendisi aynı zamanda değer: "2026_08.2" = 2026 Ağustos'un 2.
 * haftası, "2026_08" = 2026 Ağustos'un tamamı, "bugun" / "dun" = o gün. Ayrı bir
 * etiket/değer eşlemesi tutulmuyor; ekranda ne görünüyorsa sunucuya o
 * gidiyor, böylece ikisinin ayrışma ihtimali yok.
 *
 * Hafta tanımı TAKVİM SATIRI: pazartesi başlangıçlı, ayın 1'inin düştüğü
 * satır 1. hafta. ISO hafta numarası değil — kullanıcı takvime bakıp
 * "ayın 2. haftası" dediğinde kastettiği bu. Ayın ilk ve son haftası
 * kısa olabilir, bu beklenen davranış.
 */

const iki = (n: number) => String(n).padStart(2, "0");

/** Pazartesi = 0 olacak şekilde gün indeksi */
function pazartesiIndeks(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function ayKodu(d: Date): string {
  return `${d.getFullYear()}_${iki(d.getMonth() + 1)}`;
}

export function haftaKodu(d: Date): string {
  const ayinIlki = new Date(d.getFullYear(), d.getMonth(), 1);
  const kaydirma = pazartesiIndeks(ayinIlki);
  const hafta = Math.floor((d.getDate() - 1 + kaydirma) / 7) + 1;
  return `${ayKodu(d)}.${hafta}`;
}

export interface DonemAraligi {
  /** Dahil */
  bas: Date;
  /** Hariç (yarı açık aralık) */
  bit: Date;
  etiket: string;
}

/** Kod → tarih aralığı. Tanınmayan kod için null. */
export function donemAraligi(kod: string): DonemAraligi | null {
  if (kod === "tum") {
    // Çok geniş aralık = filtre yok gibi davranır
    return { bas: new Date("2000-01-01"), bit: new Date("2100-01-01"), etiket: "Tüm Zamanlar" };
  }
  if (kod === "bugun" || kod === "dun") {
    const bas = new Date();
    bas.setHours(0, 0, 0, 0);
    if (kod === "dun") bas.setDate(bas.getDate() - 1);
    const bit = new Date(bas);
    bit.setDate(bit.getDate() + 1);
    return { bas, bit, etiket: kod === "dun" ? "Dün" : "Bugün" };
  }

  const hafta = kod.match(/^(\d{4})_(\d{2})\.(\d)$/);
  if (hafta) {
    const yil = Number(hafta[1]);
    const ay = Number(hafta[2]) - 1;
    const no = Number(hafta[3]);
    const ayinIlki = new Date(yil, ay, 1);
    const kaydirma = pazartesiIndeks(ayinIlki);
    // Takvim satırının ilk günü; ayın dışına taşarsa ayın 1'ine çekilir
    const ilkGun = Math.max(1, 1 - kaydirma + (no - 1) * 7);
    const bas = new Date(yil, ay, ilkGun);
    const sonrakiAy = new Date(yil, ay + 1, 1);
    const bit = new Date(yil, ay, ilkGun + (no === 1 ? 7 - kaydirma : 7));
    return { bas, bit: bit > sonrakiAy ? sonrakiAy : bit, etiket: kod };
  }

  const aylik = kod.match(/^(\d{4})_(\d{2})$/);
  if (aylik) {
    const yil = Number(aylik[1]);
    const ay = Number(aylik[2]) - 1;
    return { bas: new Date(yil, ay, 1), bit: new Date(yil, ay + 1, 1), etiket: kod };
  }

  return null;
}

/** Bugünden geriye doğru hafta kodları (en yenisi başta) */
export function sonHaftalar(adet = 12): string[] {
  const liste: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (liste.length < adet) {
    const k = haftaKodu(d);
    if (!liste.includes(k)) liste.push(k);
    d.setDate(d.getDate() - 7);
  }
  return liste;
}

/** Bugünden geriye doğru ay kodları (en yenisi başta) */
export function sonAylar(adet = 12): string[] {
  const liste: string[] = [];
  const simdi = new Date();
  for (let i = 0; i < adet; i++) {
    liste.push(ayKodu(new Date(simdi.getFullYear(), simdi.getMonth() - i, 1)));
  }
  return liste;
}

/** "2026_08.2" → "Ağustos 2026 · 2. hafta" gibi okunur açıklama */
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
               "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

export function donemAciklama(kod: string): string {
  if (kod === "tum") return "Tüm Zamanlar";
  if (kod === "bugun") return "Bugün";
  if (kod === "dun") return "Dün";
  const h = kod.match(/^(\d{4})_(\d{2})\.(\d)$/);
  if (h) return `${AYLAR[Number(h[2]) - 1]} ${h[1]} · ${h[3]}. hafta`;
  const a = kod.match(/^(\d{4})_(\d{2})$/);
  if (a) return `${AYLAR[Number(a[2]) - 1]} ${a[1]}`;
  return kod;
}
