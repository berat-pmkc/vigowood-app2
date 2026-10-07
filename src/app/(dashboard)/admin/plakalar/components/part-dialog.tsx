"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComboboxFreesolo } from "@/components/shared/combobox-freesolo";
import { PART_TYPES, PART_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  addNewPart,
  addPlakaPart,
  previewPartCode,
  updatePartInfo,
  updatePlakaPart,
} from "../actions";
import type { TreePart, TreePlaka, TreePlakaPart } from "./tree-types";

type PartType = TreePart["part_type"];

export type PartDialogState =
  /** Yeni parça — kod otomatik. plakaId verilirse o plakaya bağlanır. */
  | { kind: "new"; sku: string | null; plakaId: string | null; plateOptions: TreePlaka[] }
  /** Parça bilgisi düzenle (+ plaka bağlamındaysa adet). */
  | { kind: "edit"; part: TreePart; pp: TreePlakaPart | null }
  /** Mevcut parçayı plakaya ekle. */
  | { kind: "link"; plaka: TreePlaka; sku: string | null; partId?: string };

interface Props {
  state: PartDialogState | null;
  onClose: () => void;
  onSaved: () => void;
  allParts: TreePart[];
  tipOptions: string[];
  renkOptions: string[];
  turOptions: string[];
}

const NONE = "__none__";

export function PartDialog({ state, onClose, onSaved, allParts, tipOptions, renkOptions, turOptions }: Props) {
  const [pending, startTransition] = useTransition();
  const [adi, setAdi] = useState("");
  const [type, setType] = useState<PartType>("YARIMAMUL");
  const [qty, setQty] = useState("");
  const [tur, setTur] = useState<string | null>(null);
  const [mdfTipi, setMdfTipi] = useState<string | null>(null);
  const [mdfRenk, setMdfRenk] = useState<string | null>(null);
  const [kritik, setKritik] = useState("0");
  const [prefix, setPrefix] = useState("");
  const [plakaId, setPlakaId] = useState<string>(NONE);
  const [code, setCode] = useState<string>("");
  const [codeErr, setCodeErr] = useState<string>("");
  const [linkPart, setLinkPart] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Dialog açılınca alanları sıfırla / doldur
  useEffect(() => {
    if (!state) return;
    setCode("");
    setCodeErr("");
    setLinkPart(state.kind === "link" ? (state.partId ?? "") : "");
    if (state.kind === "new") {
      setAdi("");
      setType("YARIMAMUL");
      setQty("");
      setTur(null);
      setMdfTipi(null);
      setMdfRenk(null);
      setKritik("0");
      setPrefix(state.sku ?? "");
      setPlakaId(state.plakaId ?? NONE);
    } else if (state.kind === "edit") {
      setAdi(state.part.part_adi);
      setType(state.part.part_type);
      setQty(state.pp?.default_qty != null ? String(state.pp.default_qty) : "");
      setTur(state.part.tur);
      setMdfTipi(state.part.mdf_tipi);
      setMdfRenk(state.part.mdf_renk);
      setKritik(String(state.part.hazir_eleman_kritik_stok ?? 0));
    } else {
      setQty("");
    }
  }, [state]);

  // Otomatik kod önizlemesi (önek değişince, debounce)
  const isNew = state?.kind === "new";
  useEffect(() => {
    if (!isNew) return;
    const p = prefix.trim();
    if (!p) {
      setCode("");
      setCodeErr("");
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await previewPartCode(p);
      if (cancelled) return;
      if (r.success) {
        setCode(r.code);
        setCodeErr("");
      } else {
        setCode("");
        setCodeErr(r.error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isNew, prefix]);

  if (!state) return null;

  const qtyNum = qty.trim() === "" ? null : Number(qty);
  const qtyBad = qtyNum != null && (Number.isNaN(qtyNum) || qtyNum < 0);

  const finish = (msg: string) => {
    toast.success(msg);
    onSaved();
    onClose();
  };

  const submit = () => {
    if (qtyBad) {
      toast.error("Miktar 0 veya üzeri bir sayı olmalıdır");
      return;
    }
    startTransition(async () => {
      if (state.kind === "new") {
        const r = await addNewPart({
          sku: state.sku,
          plaka_id: plakaId === NONE ? null : plakaId,
          part_adi: adi,
          part_type: type,
          default_qty: qtyNum,
          prefix: prefix.trim() && prefix.trim() !== state.sku ? prefix.trim() : null,
          tur,
          mdf_tipi: mdfTipi,
          mdf_renk: mdfRenk,
          kritik: Number(kritik) || 0,
        });
        if (r.success) finish(`Parça eklendi: ${r.part_id}`);
        else toast.error(r.error);
      } else if (state.kind === "edit") {
        const r = await updatePartInfo(state.part.part_id, {
          part_adi: adi,
          part_type: type,
          tur,
          mdf_tipi: mdfTipi,
          mdf_renk: mdfRenk,
          kritik: Number(kritik) || 0,
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        if (state.pp) {
          const r2 = await updatePlakaPart(state.pp.ppart_id, {
            part_id: state.part.part_id,
            default_qty: qtyNum,
          });
          if (!r2.success) {
            toast.error(r2.error);
            return;
          }
        }
        finish("Parça güncellendi");
      } else {
        if (!linkPart) {
          toast.error("Parça seçin");
          return;
        }
        const r = await addPlakaPart(state.plaka.plaka_id, state.sku, {
          part_id: linkPart,
          default_qty: qtyNum,
        });
        if (r.success) finish("Parça plakaya eklendi");
        else toast.error(r.error);
      }
    });
  };

  const title =
    state.kind === "new" ? "Yeni Parça" : state.kind === "edit" ? "Parça Düzenle" : "Mevcut Parçayı Plakaya Ekle";
  const desc =
    state.kind === "new"
      ? `${state.sku ? `Ürün: ${state.sku} · ` : ""}Parça kodu otomatik üretilir`
      : state.kind === "edit"
        ? state.part.part_id
        : `Plaka: ${state.plaka.plaka_id} — ${state.plaka.plaka_adi}`;

  const showQty = state.kind === "link" || (state.kind === "edit" && !!state.pp) || state.kind === "new";
  const showInfo = state.kind !== "link";
  const picked = allParts.find((p) => p.part_id === linkPart);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {state.kind === "new" && (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Otomatik kod</span>
                <span className="font-mono text-base font-semibold">
                  {code || (codeErr ? "—" : "...")}
                </span>
              </div>
              {codeErr && <p className="text-xs text-destructive">{codeErr}</p>}
              <div className="space-y-1">
                <Label htmlFor="pd-prefix" className="text-xs text-muted-foreground">
                  Kod öneki (varsayılan ürün SKU; ürün ailesi kodu için değiştirilebilir)
                </Label>
                <Input
                  id="pd-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="h-9 font-mono"
                  placeholder="ör: LS051"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Kod kaydedilirken yeniden hesaplanır; aynı anda başkası ekleme yaparsa numara bir sonrakine kayar.
              </p>
            </div>
          )}

          {state.kind === "new" && state.plateOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Plakaya bağla</Label>
              <Select value={plakaId} onValueChange={setPlakaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Plakaya bağlama (sadece parça kaydı)</SelectItem>
                  {state.plateOptions.map((p) => (
                    <SelectItem key={p.plaka_id} value={p.plaka_id}>
                      {p.plaka_id} — {p.plaka_adi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {state.kind === "link" && (
            <div className="space-y-2">
              <Label>Parça</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {picked ? (
                        <>
                          <span className="mr-1.5 font-mono text-xs">{picked.part_id}</span>
                          {picked.part_adi}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Parça seçin...</span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Kod veya ad ara..." />
                    <CommandList>
                      <CommandEmpty>Parça bulunamadı.</CommandEmpty>
                      <CommandGroup>
                        {allParts.map((p) => (
                          <CommandItem
                            key={p.part_id}
                            value={`${p.part_id} ${p.part_adi}`}
                            onSelect={() => {
                              setLinkPart(p.part_id);
                              setPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", linkPart === p.part_id ? "opacity-100" : "opacity-0")} />
                            <span className="mr-2 font-mono text-xs text-muted-foreground">{p.part_id}</span>
                            <span className="flex-1 truncate">{p.part_adi}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {showInfo && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pd-adi">Parça Adı</Label>
                <Input id="pd-adi" value={adi} onChange={(e) => setAdi(e.target.value)} placeholder="Parça adı..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Parça Tipi</Label>
                  <Select value={type} onValueChange={(v) => setType(v as PartType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PART_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {PART_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pd-kritik">Kritik Stok</Label>
                  <Input
                    id="pd-kritik"
                    type="number"
                    min={0}
                    value={kritik}
                    onChange={(e) => setKritik(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tür</Label>
                  <ComboboxFreesolo options={turOptions} value={tur} onChange={setTur} placeholder="Tür..." />
                </div>
                <div className="space-y-2">
                  <Label>MDF Tipi</Label>
                  <ComboboxFreesolo options={tipOptions} value={mdfTipi} onChange={setMdfTipi} placeholder="Tip..." />
                </div>
                <div className="space-y-2">
                  <Label>MDF Renk</Label>
                  <ComboboxFreesolo options={renkOptions} value={mdfRenk} onChange={setMdfRenk} placeholder="Renk..." />
                </div>
              </div>
            </>
          )}

          {showQty && (
            <div className="space-y-2">
              <Label htmlFor="pd-qty">
                Plaka başına adet {state.kind === "edit" && !state.pp ? "(plaka bağlamı yok)" : ""}
              </Label>
              <Input
                id="pd-qty"
                type="number"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
                disabled={state.kind === "new" && plakaId === NONE}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={submit} disabled={pending || (state.kind === "new" && !adi.trim())}>
            {pending ? "Kaydediliyor..." : state.kind === "edit" ? "Kaydet" : "Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
