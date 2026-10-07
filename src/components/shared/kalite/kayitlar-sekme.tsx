"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { kaliteIptal, listKaliteKayitlari } from "@/lib/kalite/actions";
import { KALITE_ITEM_TIPI_LABEL, KALITE_KAYNAK_LABEL } from "@/lib/kalite/constants";
import type { KaliteKayit, KaliteKayitTipi } from "@/lib/kalite/types";

const ISLEM_LABEL: Record<string, string> = {
  giris: "Uygunsuz girişi",
  kontrol_uygun: "Kontrol: uygun",
  sokum: "Kontrol: söküm",
  donusum_kaynak: "Dönüşüm",
  fire_giris: "Fire",
};

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(Math.abs(n));
const fmtTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Son Kayıtlar" listesi: son 7 gün, iptal butonu + neden + onay */
function KayitlarListesi({ tip, active }: { tip: KaliteKayitTipi; active: boolean }) {
  const [rows, setRows] = useState<KaliteKayit[]>([]);
  const [loading, setLoading] = useState(false);
  const [tumu, setTumu] = useState(false);
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [neden, setNeden] = useState("");
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setLoading(true);
    const r = await listKaliteKayitlari({ tip, tumu });
    setLoading(false);
    if (r.success) setRows(r.data);
    else toast.error(r.error);
  }, [tip, tumu]);

  useEffect(() => {
    if (active) void yukle();
  }, [active, yukle]);

  const iptalEt = async (id: string) => {
    if (!neden.trim()) return toast.error("İptal nedenini yazınız");
    setBusy(true);
    const r = await kaliteIptal({ id, neden });
    setBusy(false);
    if (r.success) {
      toast.success("Kayıt iptal edildi, stok etkileri geri alındı");
      setSeciliId(null);
      setNeden("");
      void yukle();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {tumu ? "Tüm kullanıcıların" : "Bu istasyonun"} son 7 gündeki kayıtları
        </p>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setTumu((v) => !v)}>
          {tumu ? "Yalnızca benimkiler" : "Tümünü göster"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{r.item_id}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {KALITE_ITEM_TIPI_LABEL[r.item_tipi]}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {ISLEM_LABEL[r.islem] ?? r.islem}
                    </Badge>
                  </div>
                  {r.item_adi && <p className="truncate text-xs text-muted-foreground">{r.item_adi}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtTarih(r.created_at)}
                    {r.operator_name && ` · ${r.operator_name}`}
                    {r.kaynak && ` · ${KALITE_KAYNAK_LABEL[r.kaynak] ?? r.kaynak}`}
                  </p>
                  {r.not_text && <p className="mt-0.5 text-xs italic text-muted-foreground">{r.not_text}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-base font-semibold tabular-nums", r.qty < 0 && "text-[#3368b1]")}>
                    {fmt(r.qty)}
                  </span>
                  {r.canCancel && seciliId !== r.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-[#ee7683] text-[#ee7683] hover:bg-[#ee7683]/10 hover:text-[#ee7683]"
                      onClick={() => {
                        setSeciliId(r.id);
                        setNeden("");
                      }}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                      İptal Et
                    </Button>
                  )}
                </div>
              </div>

              {seciliId === r.id && (
                <div className="mt-3 space-y-2 rounded-md bg-[#ee7683]/10 p-3">
                  <p className="text-xs">
                    Bu kayıt iptal edilir; oluşturduğu stok hareketleri ters hareketle geri alınır. Kayıtla birlikte
                    oluşan bağlı satırlar da iptal edilir.
                  </p>
                  <Input
                    value={neden}
                    onChange={(e) => setNeden(e.target.value)}
                    placeholder="İptal nedeni (zorunlu)"
                    className="h-11"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="h-10" onClick={() => setSeciliId(null)} disabled={busy}>
                      Vazgeç
                    </Button>
                    <Button
                      className="h-10 bg-[#ee7683] text-white hover:bg-[#ee7683]/90"
                      onClick={() => iptalEt(r.id)}
                      disabled={busy || !neden.trim()}
                    >
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      İptali Onayla
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Kalite dialoglarının içeriğini "Yeni Kayıt" | "Son Kayıtlar" sekmeleriyle sarar.
 * children = mevcut form.
 */
export function KayitlarSekme({
  tip,
  open,
  children,
}: {
  tip: KaliteKayitTipi;
  open: boolean;
  children: ReactNode;
}) {
  const [sekme, setSekme] = useState<"yeni" | "kayitlar">("yeni");

  useEffect(() => {
    if (open) setSekme("yeni");
  }, [open]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["yeni", "Yeni Kayıt"],
            ["kayitlar", "Son Kayıtlar"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSekme(k)}
            className={cn(
              "h-10 rounded-md text-sm font-medium transition-colors",
              sekme === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={sekme === "yeni" ? "" : "hidden"}>{children}</div>
      {sekme === "kayitlar" && <KayitlarListesi tip={tip} active={open} />}
    </div>
  );
}
