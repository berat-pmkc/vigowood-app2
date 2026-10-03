"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { uygunsuzGiris, listDepolar } from "@/lib/kalite/actions";
import type { DepoOption, KaliteItemOption, KaliteKaynak } from "@/lib/kalite/types";
import { ItemCombobox } from "./item-combobox";

interface UygunsuzGirisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kaynak: KaliteKaynak;
  defaultTipi?: "URUN" | "YARI_MAMUL";
  /** Tip seçimini kilitle (ör. kesim: yalnızca yarı mamul) */
  lockTipi?: boolean;
  defaultStoktanDus?: boolean;
  title?: string;
}

export function UygunsuzGirisDialog({
  open,
  onOpenChange,
  kaynak,
  defaultTipi = "URUN",
  lockTipi = false,
  defaultStoktanDus = true,
  title = "Uygunsuz Girişi",
}: UygunsuzGirisDialogProps) {
  const [tipi, setTipi] = useState<"URUN" | "YARI_MAMUL">(defaultTipi);
  const [item, setItem] = useState<KaliteItemOption | null>(null);
  const [qty, setQty] = useState("");
  const [stoktanDus, setStoktanDus] = useState(defaultStoktanDus);
  const [depoId, setDepoId] = useState("");
  const [depolar, setDepolar] = useState<DepoOption[]>([]);
  const [not, setNot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipi(defaultTipi);
    setItem(null);
    setQty("");
    setNot("");
    setDepoId("");
    setStoktanDus(defaultStoktanDus);
    listDepolar().then((r) => {
      if (r.success) setDepolar(r.data);
    });
  }, [open, defaultTipi, defaultStoktanDus]);

  const handleSubmit = async () => {
    const n = Number(qty);
    if (!item) return toast.error("Kalem seçiniz");
    if (!n || n <= 0) return toast.error("Geçerli bir adet giriniz");
    setSubmitting(true);
    const res = await uygunsuzGiris({
      itemTipi: tipi,
      itemId: item.id,
      qty: n,
      kaynak,
      stoktanDus,
      depoId: tipi === "URUN" && stoktanDus ? depoId || null : null,
      not: not.trim() || null,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Uygunsuz kaydı oluşturuldu");
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Uygunsuz bulunan ürün veya yarı mamulü kaydedin; kontrol edilene kadar uygunsuz stokta bekler.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!lockTipi && (
            <div className="grid grid-cols-2 gap-2">
              {(["URUN", "YARI_MAMUL"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tipi === t ? "default" : "outline"}
                  className={cn("h-12", tipi === t && "bg-vw-primary text-white hover:bg-vw-deep")}
                  onClick={() => {
                    setTipi(t);
                    setItem(null);
                  }}
                >
                  {t === "URUN" ? "Ürün" : "Yarı Mamul"}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>{tipi === "URUN" ? "Ürün (SKU)" : "Yarı Mamul Parça"} *</Label>
            <ItemCombobox
              key={tipi}
              tipi={tipi}
              value={item}
              onChange={setItem}
              placeholder={tipi === "URUN" ? "Ürün seçiniz..." : "Parça seçiniz..."}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ug-qty">Adet *</Label>
            <Input
              id="ug-qty"
              type="number"
              inputMode="numeric"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-12 text-lg"
              placeholder="Adet"
            />
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3">
            <Checkbox checked={stoktanDus} onCheckedChange={(v) => setStoktanDus(v === true)} className="h-5 w-5" />
            <span className="text-sm">
              Stoktan düş
              <span className="block text-xs text-muted-foreground">
                İyi stoktan çıkarılır ve uygunsuz stoğa eklenir
              </span>
            </span>
          </label>

          {tipi === "URUN" && stoktanDus && depolar.length > 0 && (
            <div className="space-y-2">
              <Label>Hangi depodan düşülsün? (isteğe bağlı)</Label>
              <Select value={depoId} onValueChange={setDepoId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Depo seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {depolar.map((d) => (
                    <SelectItem key={d.depo_id} value={d.depo_id}>
                      {d.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ug-not">Not</Label>
            <Input id="ug-not" value={not} onChange={(e) => setNot(e.target.value)} className="h-12" placeholder="Neden uygunsuz?" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="h-12 px-5" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              className="h-12 bg-[#f28a19] px-6 text-white hover:bg-[#f28a19]/90"
              onClick={handleSubmit}
              disabled={submitting || !item || !qty}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
