"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Package, Pause, Play, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dkFormat } from "@/lib/talimat/tablet-hat";
import type { TabletHatSeans } from "@/lib/talimat/types";

/** Açık (veya bekletilen) montaj/paketleme seansı: süre + Beklet/Devam + Seansı Kapat */
export function AcikSeansKarti({
  x,
  onBeklet,
  onKapat,
  baslik,
}: {
  x: TabletHatSeans;
  onBeklet: (s: TabletHatSeans) => Promise<void>;
  onKapat: (s: TabletHatSeans) => void;
  /** Ürün bilgisi gibi ek başlık (ek seans listesinde) */
  baslik?: string;
}) {
  const [, tick] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const beklemede = !!x.duraklatma_baslangic;
  const montaj = x.tur === "montaj";

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const net = x.start_time
    ? (now - new Date(x.start_time).getTime()) / 60000 -
      Number(x.duraklama_dk ?? 0) -
      (x.duraklatma_baslangic ? (now - new Date(x.duraklatma_baslangic).getTime()) / 60000 : 0)
    : 0;

  const calisanlar =
    x.workers && x.workers.length > 0 ? x.workers.map((w) => w.name).join(", ") : (x.operator_name ?? "");

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-3",
        beklemede ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50/60",
      )}
    >
      {baslik && <p className="mb-1 truncate text-sm font-semibold">{baslik}</p>}
      <div className="flex items-center gap-2">
        {montaj ? <Wrench className="size-6 shrink-0 text-blue-700" /> : <Package className="size-6 shrink-0 text-blue-700" />}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">
            {montaj ? `${x.seq_no ?? ""}. ${x.step_name ?? "Montaj"}` : "Paketleme"}
            {x.is_final_step && (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 align-middle text-xs text-emerald-800">Son</span>
            )}
          </p>
          <p className="text-base text-muted-foreground">
            {calisanlar}
            {(x.yardimci_sayisi ?? 0) > 0 && ` +${x.yardimci_sayisi} yardımcı`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Clock className={cn("size-5", beklemede ? "text-amber-600" : "text-blue-600")} />
          <span className={cn("text-2xl font-bold tabular-nums", beklemede ? "text-amber-700" : "text-blue-700")}>
            {x.start_time ? dkFormat(net) : "—"}
          </span>
        </div>
      </div>
      {beklemede && (
        <p className="mt-1 text-sm font-semibold text-amber-700">
          <Pause className="mr-1 inline size-4" />
          {montaj ? "Beklemede" : "Duraklatıldı"}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={yukleniyor}
          className={cn(
            "h-14 text-base font-semibold",
            beklemede ? "border-emerald-400 text-emerald-700" : "border-amber-400 text-amber-700",
          )}
          onClick={async () => {
            setYukleniyor(true);
            try {
              await onBeklet(x);
            } finally {
              setYukleniyor(false);
            }
          }}
        >
          {yukleniyor ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : beklemede ? (
            <Play className="mr-2 size-5" />
          ) : (
            <Pause className="mr-2 size-5" />
          )}
          {beklemede ? "Devam Et" : montaj ? "Beklet" : "Duraklat"}
        </Button>
        <Button className="h-14 bg-vw-success text-base font-bold text-white hover:bg-vw-success/90" onClick={() => onKapat(x)}>
          Seansı Kapat
        </Button>
      </div>
    </div>
  );
}
