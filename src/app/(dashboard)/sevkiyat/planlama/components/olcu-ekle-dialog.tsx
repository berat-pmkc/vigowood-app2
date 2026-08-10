"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { urunOlcuKaydet, type PlanlamaUrun } from "../actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  urun: PlanlamaUrun | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onKaydedildi: (sku: string, olcu: { boy: number; en: number; yuk: number; koliAdedi: number; koliAgirlik: number }) => void;
}

/**
 * Koli ölçüsü girme/düzeltme.
 *
 * Planlama ekranından çağrılır — ölçüsü olmayan ya da yeni çıkan bir ürün
 * için ayrı ekrana gitmeden ölçü girilip simülasyona dahil edilebilsin diye.
 */
export function OlcuEkleDialog({ urun, open, onOpenChange, onKaydedildi }: Props) {
  const [boy, setBoy] = useState("");
  const [en, setEn] = useState("");
  const [yuk, setYuk] = useState("");
  const [adet, setAdet] = useState("1");
  const [agirlik, setAgirlik] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!urun) return;
    setBoy(urun.boy != null ? String(urun.boy) : "");
    setEn(urun.en != null ? String(urun.en) : "");
    setYuk(urun.yuk != null ? String(urun.yuk) : "");
    setAdet(urun.koli_adedi != null ? String(urun.koli_adedi) : "1");
    setAgirlik(urun.koli_agirlik != null ? String(urun.koli_agirlik) : "");
  }, [urun]);

  if (!urun) return null;

  const sayi = (v: string) => Number(String(v).replace(",", "."));

  const kaydet = async () => {
    setKaydediyor(true);
    const r = await urunOlcuKaydet(urun.sku, {
      boy: sayi(boy), en: sayi(en), yuk: sayi(yuk),
      koli_adedi: sayi(adet),
      koli_agirlik: agirlik.trim() ? sayi(agirlik) : null,
    });
    setKaydediyor(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Ölçü kaydedildi");
    onKaydedildi(urun.sku, {
      boy: sayi(boy), en: sayi(en), yuk: sayi(yuk),
      koliAdedi: sayi(adet), koliAgirlik: agirlik.trim() ? sayi(agirlik) : 0,
    });
    onOpenChange(false);
  };

  const alan = (etiket: string, deger: string, set: (v: string) => void, ipucu?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{etiket}</Label>
      <Input value={deger} onChange={(e) => set(e.target.value)} className="h-9" inputMode="decimal" />
      {ipucu ? <p className="text-[11px] text-muted-foreground">{ipucu}</p> : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Koli Ölçüsü</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{urun.sku}</span>
            {urun.urun_adi ? ` — ${urun.urun_adi}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          {alan("Boy (cm)", boy, setBoy)}
          {alan("En (cm)", en, setEn)}
          {alan("Yükseklik (cm)", yuk, setYuk)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {alan("Koli içi adet", adet, setAdet, "Bir koliye kaç ürün giriyor")}
          {alan("Koli ağırlığı (kg)", agirlik, setAgirlik, "Boş bırakılabilir")}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ölçüler masterbox yani sevk kolisinin dış ölçüleri olmalı, ürünün kendi
          ölçüsü değil. Kaydedilen ölçü ürün kartına da işlenir.
        </p>

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={kaydediyor}>
            Vazgeç
          </Button>
          <Button className="flex-1" onClick={kaydet} disabled={kaydediyor}>
            {kaydediyor ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
