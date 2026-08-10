/// <reference lib="webworker" />
/**
 * Yerleştirme hesabı Web Worker'da çalışır.
 *
 * Arama saniyeler sürdüğü için ana iş parçacığında çalışsa arayüz donardı.
 * Sunucuda çalıştırmak da mümkün değil: Vercel Hobby planında fonksiyon
 * 10 saniyede kesiliyor, bu da aramayı ciddi biçimde kısıtlardı.
 */
import { planla } from "./packer";
import { dogrula } from "./verify";
import type { Konteyner, PackAyar, PackSonuc, PackUrun } from "./types";

export interface WorkerGirdi {
  urunler: PackUrun[];
  konteyner: Konteyner;
  ayar: Partial<PackAyar>;
}

export type WorkerCikti =
  | { tip: "ilerleme"; yuzde: number }
  | { tip: "sonuc"; sonuc: PackSonuc; dogrulama: { gecerli: boolean; hatalar: string[] } }
  | { tip: "hata"; mesaj: string };

self.onmessage = (e: MessageEvent<WorkerGirdi>) => {
  try {
    const { urunler, konteyner, ayar } = e.data;
    const sonuc = planla(urunler, konteyner, ayar, (yuzde) => {
      (self as unknown as Worker).postMessage({ tip: "ilerleme", yuzde } satisfies WorkerCikti);
    });
    const dogrulama = dogrula(sonuc.bloklar, konteyner, urunler);
    (self as unknown as Worker).postMessage({ tip: "sonuc", sonuc, dogrulama } satisfies WorkerCikti);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      tip: "hata",
      mesaj: err instanceof Error ? err.message : "Hesaplama sırasında hata",
    } satisfies WorkerCikti);
  }
};
