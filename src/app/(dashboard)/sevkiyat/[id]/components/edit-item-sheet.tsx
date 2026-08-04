"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { updateSevkiyatItem } from "../../actions";
import type { SevkiyatItemRow } from "../../actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditItemSheetProps {
  item: SevkiyatItemRow | null;
  /** Aynı sevkiyatın diğer kalemleri — eksik palet bilgisini tahmin etmek için */
  siblings: SevkiyatItemRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface FormState {
  palet_boyut: string;
  palet_yukseklik: string;
  en: string;
  boy: string;
  yuk: string;
  koli_adedi: string;
  palette_koli: string;
  koli_agirlik: string;
  palet_sayisi: string;
  grup: string;
}

const BOS: FormState = {
  palet_boyut: "",
  palet_yukseklik: "",
  en: "",
  boy: "",
  yuk: "",
  koli_adedi: "",
  palette_koli: "",
  koli_agirlik: "",
  palet_sayisi: "",
  grup: "",
};

/** Bir listedeki en sık geçen değeri döndürür (eksik palet bilgisini tahmin için) */
function enSik<T>(degerler: (T | null | undefined)[]): T | null {
  const sayim = new Map<T, number>();
  for (const d of degerler) {
    if (d === null || d === undefined || d === ("" as unknown as T)) continue;
    sayim.set(d, (sayim.get(d) ?? 0) + 1);
  }
  let enIyi: T | null = null;
  let enCok = 0;
  for (const [d, n] of sayim) {
    if (n > enCok) {
      enIyi = d;
      enCok = n;
    }
  }
  return enIyi;
}

/**
 * Formu mevcut değerlerle doldurur.
 *
 * Bazı kalemlerde palet bilgisi hiç girilmemiş olabiliyor (dışarıdan
 * aktarılan planlar). Bu alanlar boş bırakılsa kullanıcı tek bir sayıyı
 * değiştirmek için bilmediği dört alanı doldurmak zorunda kalıyor. Bu yüzden
 * eksik olanlar aynı sevkiyatın diğer kalemlerinden tahmin ediliyor.
 *
 * Palet sayısı ve palet başına koli tahmin edilirken kayıtlı toplam koli
 * korunur (palet sayısı 1, palet başına koli = toplam koli) — böylece adet
 * değeri kesinlikle değişmez.
 */
function doldur(item: SevkiyatItemRow, siblings: SevkiyatItemRow[]): {
  form: FormState;
  tahminEdilen: Set<keyof FormState>;
} {
  const tahminEdilen = new Set<keyof FormState>();
  const digerleri = siblings.filter((s) => s.item_id !== item.item_id);

  let paletBoyut = item.palet_boyut ?? "";
  if (!paletBoyut) {
    paletBoyut = enSik(digerleri.map((s) => s.palet_boyut)) ?? "100x120";
    tahminEdilen.add("palet_boyut");
  }

  let paletYukseklik = item.palet_yukseklik;
  if (paletYukseklik == null) {
    paletYukseklik = enSik(digerleri.map((s) => s.palet_yukseklik)) ?? 125;
    tahminEdilen.add("palet_yukseklik");
  }

  // Toplam koliyi bozmadan geri türet
  let paletSayisi = item.palet_sayisi;
  let paletteKoli = item.palette_koli;
  const toplamKoli = item.toplam_koli ?? 0;

  if (paletSayisi == null && paletteKoli == null) {
    paletSayisi = 1;
    paletteKoli = toplamKoli || 1;
    tahminEdilen.add("palet_sayisi");
    tahminEdilen.add("palette_koli");
  } else if (paletSayisi == null) {
    paletSayisi = paletteKoli ? Math.max(1, Math.round(toplamKoli / paletteKoli)) : 1;
    tahminEdilen.add("palet_sayisi");
  } else if (paletteKoli == null) {
    paletteKoli = paletSayisi ? Math.max(1, Math.round(toplamKoli / paletSayisi)) : toplamKoli;
    tahminEdilen.add("palette_koli");
  }

  return {
    form: {
      palet_boyut: paletBoyut,
      palet_yukseklik: String(paletYukseklik),
      en: String(item.en ?? ""),
      boy: String(item.boy ?? ""),
      yuk: String(item.yuk ?? ""),
      koli_adedi: String(item.koli_adedi ?? ""),
      palette_koli: String(paletteKoli ?? ""),
      koli_agirlik: String(item.koli_agirlik ?? ""),
      palet_sayisi: String(paletSayisi ?? ""),
      grup: item.grup ?? "",
    },
    tahminEdilen,
  };
}

const sayi = (v: string) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sunucudaki calculateLogistics ile birebir aynı formüller.
 * Kullanıcı kaydetmeden önce sonucu görebilsin diye burada da hesaplanıyor.
 */
function hesapla(f: FormState) {
  const toplamKoli = sayi(f.palette_koli) * sayi(f.palet_sayisi);
  const adet = sayi(f.koli_adedi) * toplamKoli;
  const agirlik = sayi(f.koli_agirlik) * toplamKoli;
  const parcalar = f.palet_boyut.split("x").map(Number);
  const pEn = parcalar[0];
  const pBoy = parcalar[1];
  const hacim =
    ((pEn || 80) * (pBoy || 120) * sayi(f.palet_yukseklik) * sayi(f.palet_sayisi)) / 1_000_000;
  return {
    toplamKoli,
    adet,
    agirlik,
    hacim: Math.round(hacim * 1000) / 1000,
    desi: Math.round(hacim * 333.33 * 100) / 100,
  };
}

export function EditItemSheet({ item, siblings, open, onOpenChange, onSaved }: EditItemSheetProps) {
  const [form, setForm] = useState<FormState>(BOS);
  const [tahmin, setTahmin] = useState<Set<keyof FormState>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    const { form: f, tahminEdilen } = doldur(item, siblings);
    setForm(f);
    setTahmin(tahminEdilen);
  }, [item, siblings]);

  if (!item) return null;

  const sonuc = hesapla(form);

  const bicim = (v: number | null | undefined, birim = "", ondalik = 0) =>
    v === null || v === undefined
      ? "—"
      : v.toLocaleString("tr-TR", {
          minimumFractionDigits: ondalik,
          maximumFractionDigits: ondalik,
        }) + birim;

  const karsilastirma = [
    {
      etiket: "Toplam koli",
      oncesi: bicim(item.toplam_koli),
      sonrasi: bicim(sonuc.toplamKoli),
      degisti: (item.toplam_koli ?? 0) !== sonuc.toplamKoli,
    },
    {
      etiket: "Toplam adet",
      oncesi: bicim(item.qty),
      sonrasi: bicim(sonuc.adet),
      degisti: (item.qty ?? 0) !== sonuc.adet,
    },
    {
      etiket: "Ağırlık",
      oncesi: bicim(item.agirlik != null ? Math.round(item.agirlik) : null, " kg"),
      sonrasi: bicim(Math.round(sonuc.agirlik), " kg"),
      degisti: Math.round(item.agirlik ?? 0) !== Math.round(sonuc.agirlik),
    },
    {
      etiket: "Hacim",
      oncesi: bicim(item.hacim, " m³", 2),
      sonrasi: bicim(sonuc.hacim, " m³", 2),
      degisti: Math.abs((item.hacim ?? 0) - sonuc.hacim) > 0.005,
    },
    {
      etiket: "Desi",
      oncesi: bicim(item.desi, "", 0),
      sonrasi: bicim(sonuc.desi, "", 0),
      degisti: Math.abs((item.desi ?? 0) - sonuc.desi) > 0.5,
    },
  ];

  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const kaydet = async () => {
    if (sayi(form.palet_sayisi) < 1) {
      toast.error("Palet sayısı en az 1 olmalıdır");
      return;
    }
    if (sayi(form.palette_koli) < 1 || sayi(form.koli_adedi) < 1) {
      toast.error("Palet başına koli ve koli içi adet en az 1 olmalıdır");
      return;
    }
    if (!form.palet_boyut.includes("x")) {
      toast.error("Palet boyutu 100x120 biçiminde olmalıdır");
      return;
    }

    setSaving(true);
    const r = await updateSevkiyatItem(item.item_id, {
      palet_boyut: form.palet_boyut.trim(),
      palet_yukseklik: sayi(form.palet_yukseklik),
      en: sayi(form.en),
      boy: sayi(form.boy),
      yuk: sayi(form.yuk),
      koli_adedi: sayi(form.koli_adedi),
      palette_koli: sayi(form.palette_koli),
      koli_agirlik: sayi(form.koli_agirlik),
      palet_sayisi: sayi(form.palet_sayisi),
      grup: form.grup.trim() || null,
    });
    setSaving(false);

    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Kalem güncellendi");
    onOpenChange(false);
    onSaved();
  };

  const alan = (
    etiket: string,
    k: keyof FormState,
    opts?: { ipucu?: string; tip?: string }
  ) => {
    const tahminMi = tahmin.has(k);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={k} className="text-xs flex items-center gap-1">
          {etiket}
          {tahminMi ? (
            <span className="text-amber-600 text-[10px] font-normal">• tahmin</span>
          ) : null}
        </Label>
        <Input
          id={k}
          type={opts?.tip ?? "number"}
          value={form[k]}
          onChange={set(k)}
          className={"h-9" + (tahminMi ? " border-amber-400 bg-amber-50/50" : "")}
        />
        {opts?.ipucu ? (
          <p className="text-[11px] text-muted-foreground">{opts.ipucu}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kalemi Düzenle</SheetTitle>
          <SheetDescription>
            <span className="font-mono">{item.sku}</span>
            {item.urun_adi ? " — " + item.urun_adi : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">PALET</p>
            <div className="grid grid-cols-2 gap-3">
              {alan("Palet boyutu", "palet_boyut", { tip: "text", ipucu: "örn. 100x120" })}
              {alan("Palet yüksekliği (cm)", "palet_yukseklik")}
              {alan("Palet sayısı", "palet_sayisi")}
              {alan("Grup", "grup", { tip: "text" })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">KOLİ</p>
            <div className="grid grid-cols-2 gap-3">
              {alan("Palet başına koli", "palette_koli")}
              {alan("Koli içi adet", "koli_adedi")}
              {alan("Koli ağırlığı (kg)", "koli_agirlik")}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              KOLİ ÖLÇÜLERİ (cm)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {alan("En", "en")}
              {alan("Boy", "boy")}
              {alan("Yükseklik", "yuk")}
            </div>
          </div>

          {tahmin.size > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">Bazı alanlar kayıtlı değildi.</span> Sarı
                işaretli kutulara aynı sevkiyattaki diğer kalemlere bakılarak tahmini
                değerler yazıldı. Adet değişmez ama hacim ve ağırlık yeniden hesaplanır —
                aşağıdaki karşılaştırmayı kontrol edin.
              </p>
            </div>
          ) : null}

          <Card className="p-3 bg-muted/40">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-sm items-center">
              <span className="text-xs font-semibold text-muted-foreground">DEĞER</span>
              <span className="text-xs font-semibold text-muted-foreground text-right">
                ŞU AN
              </span>
              <span className="text-xs font-semibold text-muted-foreground text-right">
                KAYIT SONRASI
              </span>

              {karsilastirma.map((r) => (
                <Fragment key={r.etiket}>
                  <span className="text-muted-foreground">{r.etiket}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {r.oncesi}
                  </span>
                  <span
                    className={
                      "text-right tabular-nums font-semibold " +
                      (r.degisti ? "text-amber-700" : "")
                    }
                  >
                    {r.sonrasi}
                  </span>
                </Fragment>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              Adet doğrudan girilmez: palet sayısı, palet başına koli ve koli içi adet
              değerlerinden hesaplanır. Böylece palet planı ile adet birbirinden kopmaz.
            </p>
          </Card>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Vazgeç
          </Button>
          <Button className="flex-1" onClick={kaydet} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Kaydet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
