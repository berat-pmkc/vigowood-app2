"use client";

import { useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { plakalariGetir } from "@/lib/talimat/actions";
import { plakaOzetiGetir, type PlakaParcaOzet } from "@/lib/talimat/admin-actions";
import type { PlakaSecenek } from "@/lib/talimat/types";
import { cn } from "@/lib/utils";

interface Props {
  sku: string | null;
  plakaId: string | null;
  plakaAdi: string | null;
  onSelect: (plakaId: string | null) => void;
  disabled?: boolean;
}

/** Kesim satırı: önce ürün seçilir, sonra bu ürünün parçalarını kesen plakalar listelenir */
export function PlakaSecici({ sku, plakaId, plakaAdi, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plakalar, setPlakalar] = useState<PlakaSecenek[]>([]);
  const [ozet, setOzet] = useState<Record<string, PlakaParcaOzet[]>>({});

  const yukle = async () => {
    if (!sku) return;
    setLoading(true);
    const r = await plakalariGetir(sku);
    const liste = r.success ? r.data : [];
    setPlakalar(liste);
    const ozetler = await Promise.all(
      liste.map(async (p) => {
        const o = await plakaOzetiGetir(p.plaka_id);
        return [p.plaka_id, o.success ? o.data : []] as const;
      }),
    );
    setOzet(Object.fromEntries(ozetler));
    setLoading(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void yukle();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || !sku}
          title={!sku ? "Önce ürün seçin" : undefined}
          className={cn(
            "mt-1 inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]",
            plakaId ? "border-vw-side bg-vw-light text-vw-deep" : "border-dashed border-vw-side/60 text-muted-foreground",
            "disabled:opacity-50",
          )}
        >
          <Layers className="h-3 w-3 shrink-0" />
          <span className="truncate">{plakaId ? (plakaAdi ?? plakaId) : sku ? "Plaka seç" : "Önce ürün seçin"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)] p-2" align="start">
        {loading ? (
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Plakalar yükleniyor...
          </div>
        ) : plakalar.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">Bu ürünün parçalarını kesen plaka bulunamadı.</div>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {plakaId && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="w-full rounded px-2 py-1 text-left text-xs text-[#c0424f] hover:bg-muted"
              >
                Plakayı kaldır
              </button>
            )}
            {plakalar.map((p) => (
              <button
                key={p.plaka_id}
                type="button"
                onClick={() => {
                  onSelect(p.plaka_id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded border px-2 py-1.5 text-left hover:bg-vw-light",
                  p.plaka_id === plakaId ? "border-vw-deep bg-vw-light" : "border-transparent",
                )}
              >
                <div className="text-sm font-medium">{p.plaka_adi ?? p.plaka_id}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(ozet[p.plaka_id] ?? []).length === 0
                    ? "Parça bilgisi yok"
                    : (ozet[p.plaka_id] ?? [])
                        .map((x) => `${x.part_adi ?? x.part_id}${x.adet ? ` ×${x.adet}` : ""}`)
                        .join(", ")}
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
