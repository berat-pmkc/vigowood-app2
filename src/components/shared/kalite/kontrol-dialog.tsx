"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listUygunsuzItems,
  listDepolar,
  getUrunYariMamulleri,
  kontrolUygun,
  kontrolSokum,
  fireGiris,
} from "@/lib/kalite/actions";
import type { DepoOption, KaliteItemOption, UrunParcasi } from "@/lib/kalite/types";
import { ItemCombobox } from "./item-combobox";
import { KayitlarSekme } from "./kayitlar-sekme";

type Sonuc = "uygun" | "sokum" | "fire";

interface KontrolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hangi kalem tipleri kontrol edilebilir */
  tipler?: ("URUN" | "YARI_MAMUL")[];
  title?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);

export function KontrolDialog({
  open,
  onOpenChange,
  tipler = ["URUN", "YARI_MAMUL"],
  title = "Kontrol Edilen Uygunsuz",
}: KontrolDialogProps) {
  const [tipi, setTipi] = useState<"URUN" | "YARI_MAMUL">(tipler[0]);
  const [options, setOptions] = useState<KaliteItemOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [item, setItem] = useState<KaliteItemOption | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc>("uygun");
  const [qty, setQty] = useState("");
  const [depoId, setDepoId] = useState("");
  const [depolar, setDepolar] = useState<DepoOption[]>([]);
  const [parts, setParts] = useState<UrunParcasi[]>([]);
  const [partInputs, setPartInputs] = useState<Record<string, { fire: string; uygunsuz: string }>>({});
  const [loadingParts, setLoadingParts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dialog açılışında sıfırla
  useEffect(() => {
    if (!open) return;
    setTipi(tipler[0]);
    setItem(null);
    setSonuc("uygun");
    setQty("");
    setDepoId("");
    listDepolar().then((r) => {
      if (r.success) setDepolar(r.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Yalnızca uygunsuz bakiyesi > 0 olanlar
  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    setItem(null);
    listUygunsuzItems(tipi).then((r) => {
      setOptions(r.success ? r.data : []);
      if (!r.success) toast.error(r.error);
      setLoadingList(false);
    });
  }, [open, tipi]);

  // Söküm için parça listesi
  useEffect(() => {
    if (sonuc !== "sokum" || tipi !== "URUN" || !item) {
      setParts([]);
      return;
    }
    setLoadingParts(true);
    getUrunYariMamulleri(item.id).then((r) => {
      if (r.success) {
        // Söküm yalnızca yarı mamulleri kapsar; hazır elemanlar listelenmez.
        setParts(r.data.filter((p) => p.part_type === "YARIMAMUL"));
        setPartInputs({});
      } else {
        toast.error(r.error);
      }
      setLoadingParts(false);
    });
  }, [sonuc, tipi, item]);

  const numQty = Number(qty) || 0;
  const maxQty = item?.uygunsuz ?? 0;

  const rows = useMemo(
    () =>
      parts.map((p) => {
        const inp = partInputs[p.part_id] ?? { fire: "", uygunsuz: "" };
        const fire = Number(inp.fire) || 0;
        const uygunsuz = Number(inp.uygunsuz) || 0;
        const beklenen = p.qty_per * numQty;
        const asiri = fire + uygunsuz > beklenen + 1e-9;
        return { p, inp, fire, uygunsuz, beklenen, saglam: Math.max(beklenen - fire - uygunsuz, 0), asiri };
      }),
    [parts, partInputs, numQty]
  );

  const toplamlar = useMemo(
    () => ({
      saglam: rows.reduce((t, r) => t + r.saglam, 0),
      fire: rows.reduce((t, r) => t + r.fire, 0),
      uygunsuz: rows.reduce((t, r) => t + r.uygunsuz, 0),
    }),
    [rows]
  );
  const sokumHatali = sonuc === "sokum" && rows.some((r) => r.asiri || r.fire < 0 || r.uygunsuz < 0);

  const setPartInput = (id: string, field: "fire" | "uygunsuz", v: string) =>
    setPartInputs((s) => ({ ...s, [id]: { ...(s[id] ?? { fire: "", uygunsuz: "" }), [field]: v } }));

  const handleSubmit = async () => {
    if (!item) return toast.error("Kalem seçiniz");
    if (!numQty || numQty <= 0) return toast.error("Geçerli bir adet giriniz");
    if (numQty > maxQty) return toast.error(`En fazla ${fmt(maxQty)} adet kontrol edilebilir`);

    setSubmitting(true);
    let res;
    if (sonuc === "uygun") {
      if (tipi === "URUN" && !depoId) {
        setSubmitting(false);
        return toast.error("Ürünün gireceği depoyu seçiniz");
      }
      res = await kontrolUygun({ itemTipi: tipi, itemId: item.id, qty: numQty, depoId: depoId || null });
    } else if (sonuc === "sokum") {
      if (rows.some((r) => r.asiri)) {
        setSubmitting(false);
        return toast.error("Fire + uygunsuz parça toplamını aşamaz");
      }
      res = await kontrolSokum({
        sku: item.id,
        qty: numQty,
        parts: rows.map((r) => ({ part_id: r.p.part_id, fire: r.fire, uygunsuz: r.uygunsuz })),
      });
    } else {
      res = await fireGiris({
        itemTipi: tipi,
        itemId: item.id,
        qty: numQty,
        kaynak: "kontrol",
        stoktanDus: false,
        fromUygunsuz: true,
      });
    }
    setSubmitting(false);
    if (res.success) {
      toast.success("Kontrol sonucu kaydedildi");
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  const sonucOptions: { key: Sonuc; label: string; color: string }[] = [
    { key: "uygun", label: "Uygun", color: "bg-[#70c1aa] hover:bg-[#70c1aa]/90" },
    ...(tipi === "URUN"
      ? [{ key: "sokum" as Sonuc, label: "Söküm yapıldı", color: "bg-[#3368b1] hover:bg-[#3368b1]/90" }]
      : []),
    { key: "fire", label: "Fire", color: "bg-[#ee7683] hover:bg-[#ee7683]/90" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Yalnızca uygunsuz bakiyesi olan kalemler listelenir.
          </DialogDescription>
        </DialogHeader>

        <KayitlarSekme tip="kontrol" open={open}>
        <div className="space-y-4">
          {tipler.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {tipler.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tipi === t ? "default" : "outline"}
                  className={cn("h-12", tipi === t && "bg-vw-primary text-white hover:bg-vw-deep")}
                  onClick={() => {
                    setTipi(t);
                    setSonuc("uygun");
                  }}
                >
                  {t === "URUN" ? "Ürün" : "Yarı Mamul"}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Uygunsuz kalem *</Label>
            <ItemCombobox
              key={tipi}
              options={options}
              value={item}
              onChange={(it) => {
                setItem(it);
                setQty(it ? String(it.uygunsuz ?? "") : "");
              }}
              placeholder={loadingList ? "Yükleniyor..." : "Uygunsuz kalem seçiniz..."}
              emptyText="Uygunsuz bakiyesi olan kalem yok."
              disabled={loadingList}
            />
          </div>

          {item && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {sonucOptions.map((o) => (
                  <Button
                    key={o.key}
                    type="button"
                    variant={sonuc === o.key ? "default" : "outline"}
                    className={cn("h-12 px-2 text-sm", sonuc === o.key && `${o.color} text-white`)}
                    onClick={() => setSonuc(o.key)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="kd-qty">
                  Adet * <span className="font-normal text-muted-foreground">(en fazla {fmt(maxQty)})</span>
                </Label>
                <Input
                  id="kd-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>

              {sonuc === "uygun" && tipi === "URUN" && (
                <div className="space-y-2">
                  <Label>Hangi depoya girsin? *</Label>
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

              {sonuc === "sokum" && (
                <div className="space-y-2">
                  <Label>Parçalar</Label>
                  {loadingParts ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : rows.length === 0 ? (
                    <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                      Bu ürün için sökülebilir parça bulunamadı.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((r) => (
                        <div
                          key={r.p.part_id}
                          className={cn("rounded-lg border p-3", r.asiri && "border-destructive bg-destructive/5")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-sm font-medium">{r.p.part_id}</span>
                              <p className="truncate text-xs text-muted-foreground">{r.p.part_adi}</p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Toplam: <b>{fmt(r.beklenen)}</b>
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Fire</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={r.inp.fire}
                                onChange={(e) => setPartInput(r.p.part_id, "fire", e.target.value)}
                                className="h-12 text-lg"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Uygunsuz</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={r.inp.uygunsuz}
                                onChange={(e) => setPartInput(r.p.part_id, "uygunsuz", e.target.value)}
                                className="h-12 text-lg"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex flex-col justify-end pb-2">
                              <span className="text-xs text-muted-foreground">Sağlam</span>
                              <span className="text-lg font-semibold text-[#3caa35]">{fmt(r.saglam)}</span>
                            </div>
                          </div>
                          {r.asiri && (
                            <p className="mt-1.5 text-xs font-medium text-destructive">
                              Fire + uygunsuz toplamı {fmt(r.beklenen)} adedi aşamaz
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        Toplam: <b className="text-[#3caa35]">Sağlam {fmt(toplamlar.saglam)}</b>
                        {" · "}
                        <b className="text-[#ee7683]">Fire {fmt(toplamlar.fire)}</b>
                        {" · "}
                        <b className="text-[#f28a19]">Uygunsuz {fmt(toplamlar.uygunsuz)}</b>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="h-12 px-5" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              className="h-12 bg-[#3368b1] px-6 text-white hover:bg-[#3368b1]/90"
              onClick={handleSubmit}
              disabled={submitting || !item || !qty || sokumHatali}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </div>
        </KayitlarSekme>
      </DialogContent>
    </Dialog>
  );
}
