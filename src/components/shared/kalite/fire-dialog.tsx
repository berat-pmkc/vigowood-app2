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
import { cn } from "@/lib/utils";
import { fireGiris, getUrunYariMamulleri } from "@/lib/kalite/actions";
import type { KaliteItemOption, KaliteItemTipi, KaliteKaynak, UrunParcasi } from "@/lib/kalite/types";
import { KALITE_ITEM_TIPI_LABEL } from "@/lib/kalite/constants";
import { ItemCombobox } from "./item-combobox";

interface FireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kaynak: KaliteKaynak;
  tipler?: KaliteItemTipi[];
  title?: string;
}

export function FireDialog({
  open,
  onOpenChange,
  kaynak,
  tipler = ["URUN", "YARI_MAMUL", "PLAKA"],
  title = "Fire Girişi",
}: FireDialogProps) {
  const [tipi, setTipi] = useState<KaliteItemTipi>(tipler[0]);
  const [item, setItem] = useState<KaliteItemOption | null>(null);
  const [urunModu, setUrunModu] = useState<"parca" | "butun">("parca");
  const [qty, setQty] = useState("");
  const [stoktanDus, setStoktanDus] = useState(true);
  const [not, setNot] = useState("");
  const [parts, setParts] = useState<UrunParcasi[]>([]);
  const [partQty, setPartQty] = useState<Record<string, string>>({});
  const [loadingParts, setLoadingParts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipi(tipler[0]);
    setItem(null);
    setUrunModu("parca");
    setQty("");
    setNot("");
    setStoktanDus(true);
    setParts([]);
    setPartQty({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (tipi !== "URUN" || urunModu !== "parca" || !item) {
      setParts([]);
      return;
    }
    setLoadingParts(true);
    getUrunYariMamulleri(item.id).then((r) => {
      if (r.success) {
        // Yan malzemeler (hazır eleman) şimdilik fire kapsamı dışında; yalnızca yarı mamuller.
        setParts(r.data.filter((p) => p.part_type === "YARIMAMUL"));
        setPartQty({});
      } else {
        toast.error(r.error);
      }
      setLoadingParts(false);
    });
  }, [tipi, urunModu, item]);

  const partsMode = tipi === "URUN" && urunModu === "parca";

  const handleSubmit = async () => {
    if (!item) return toast.error("Kalem seçiniz");
    setSubmitting(true);
    let res;
    if (partsMode) {
      const list = parts
        .map((p) => ({ part_id: p.part_id, qty: Number(partQty[p.part_id]) || 0 }))
        .filter((p) => p.qty > 0);
      if (list.length === 0) {
        setSubmitting(false);
        return toast.error("En az bir parçaya fire miktarı giriniz");
      }
      res = await fireGiris({
        itemTipi: "URUN",
        itemId: item.id,
        kaynak,
        stoktanDus,
        parts: list,
        not: not.trim() || null,
      });
    } else {
      const n = Number(qty);
      if (!n || n <= 0) {
        setSubmitting(false);
        return toast.error("Geçerli bir miktar giriniz");
      }
      res = await fireGiris({
        itemTipi: tipi,
        itemId: item.id,
        qty: n,
        kaynak,
        stoktanDus,
        not: not.trim() || null,
      });
    }
    setSubmitting(false);
    if (res.success) {
      toast.success("Fire kaydedildi");
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Hurdaya çıkan ürün, parça veya plakayı kaydedin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {tipler.length > 1 && (
            <div className={cn("grid gap-2", tipler.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {tipler.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tipi === t ? "default" : "outline"}
                  className={cn("h-12 px-2 text-sm", tipi === t && "bg-[#ee7683] text-white hover:bg-[#ee7683]/90")}
                  onClick={() => {
                    setTipi(t);
                    setItem(null);
                    setQty("");
                  }}
                >
                  {KALITE_ITEM_TIPI_LABEL[t]}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {tipi === "URUN" ? "Ürün (SKU)" : tipi === "PLAKA" ? "Plaka (MDF)" : "Yarı Mamul Parça"} *
            </Label>
            <ItemCombobox key={tipi} tipi={tipi} value={item} onChange={setItem} placeholder="Seçiniz..." />
          </div>

          {tipi === "URUN" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={urunModu === "parca" ? "default" : "outline"}
                className={cn("h-11", urunModu === "parca" && "bg-vw-primary text-white hover:bg-vw-deep")}
                onClick={() => setUrunModu("parca")}
              >
                Parça bazlı
              </Button>
              <Button
                type="button"
                variant={urunModu === "butun" ? "default" : "outline"}
                className={cn("h-11", urunModu === "butun" && "bg-vw-primary text-white hover:bg-vw-deep")}
                onClick={() => setUrunModu("butun")}
              >
                Bütün ürün
              </Button>
            </div>
          )}

          {partsMode ? (
            item && (
              <div className="space-y-2">
                <Label>Parça bazlı fire miktarı</Label>
                {loadingParts ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : parts.length === 0 ? (
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                    Bu ürün için parça listesi bulunamadı.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {parts.map((p) => (
                      <div key={p.part_id} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-sm font-medium">{p.part_id}</span>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.part_adi} · Ürün başına {p.qty_per}
                          </p>
                        </div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={partQty[p.part_id] ?? ""}
                          onChange={(e) => setPartQty((s) => ({ ...s, [p.part_id]: e.target.value }))}
                          className="h-11 w-24 text-center"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="space-y-2">
              <Label htmlFor="fd-qty">Miktar *</Label>
              <Input
                id="fd-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-12 text-lg"
                placeholder="Adet"
              />
            </div>
          )}

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3">
            <Checkbox checked={stoktanDus} onCheckedChange={(v) => setStoktanDus(v === true)} className="h-5 w-5" />
            <span className="text-sm">
              Stoktan düş
              <span className="block text-xs text-muted-foreground">
                İşaretliyse ilgili stok miktarı da azaltılır
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="fd-not">Not</Label>
            <Input id="fd-not" value={not} onChange={(e) => setNot(e.target.value)} className="h-12" placeholder="Fire nedeni" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="h-12 px-5" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              className="h-12 bg-[#ee7683] px-6 text-white hover:bg-[#ee7683]/90"
              onClick={handleSubmit}
              disabled={submitting || !item}
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
