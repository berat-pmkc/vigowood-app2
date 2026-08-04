"use client";

import { useEffect, useState } from "react";
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

function doldur(item: SevkiyatItemRow): FormState {
  return {
    palet_boyut: item.palet_boyut ?? "",
    palet_yukseklik: String(item.palet_yukseklik ?? ""),
    en: String(item.en ?? ""),
    boy: String(item.boy ?? ""),
    yuk: String(item.yuk ?? ""),
    koli_adedi: String(item.koli_adedi ?? ""),
    palette_koli: String(item.palette_koli ?? ""),
    koli_agirlik: String(item.koli_agirlik ?? ""),
    palet_sayisi: String(item.palet_sayisi ?? ""),
    grup: item.grup ?? "",
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

export function EditItemSheet({ item, open, onOpenChange, onSaved }: EditItemSheetProps) {
  const [form, setForm] = useState<FormState>(BOS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setForm(doldur(item));
  }, [item]);

  if (!item) return null;

  const sonuc = hesapla(form);
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
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs">
        {etiket}
      </Label>
      <Input
        id={k}
        type={opts?.tip ?? "number"}
        value={form[k]}
        onChange={set(k)}
        className="h-9"
      />
      {opts?.ipucu ? (
        <p className="text-[11px] text-muted-foreground">{opts.ipucu}</p>
      ) : null}
    </div>
  );

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

          <Card className="p-3 bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              HESAPLANAN DEĞERLER
            </p>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Toplam koli</span>
              <span className="text-right font-semibold tabular-nums">
                {sonuc.toplamKoli.toLocaleString("tr-TR")}
              </span>
              <span className="text-muted-foreground">Toplam adet</span>
              <span className="text-right font-semibold tabular-nums">
                {sonuc.adet.toLocaleString("tr-TR")}
              </span>
              <span className="text-muted-foreground">Ağırlık</span>
              <span className="text-right font-semibold tabular-nums">
                {Math.round(sonuc.agirlik).toLocaleString("tr-TR")} kg
              </span>
              <span className="text-muted-foreground">Hacim</span>
              <span className="text-right font-semibold tabular-nums">
                {sonuc.hacim.toFixed(2)} m³
              </span>
              <span className="text-muted-foreground">Desi</span>
              <span className="text-right font-semibold tabular-nums">
                {sonuc.desi.toLocaleString("tr-TR")}
              </span>
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
