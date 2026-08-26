"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { iptalKesimTalebi, silKesimTalebi, type KesimTalebi } from "../../actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Flame, X, PackageCheck, Trash2 } from "lucide-react";

interface Props {
  talepler: KesimTalebi[];
  /** Kesimhane ekranında "Kesime Başla" butonu görünür */
  kesimeBaslaGoster?: boolean;
  onKesimeBasla?: (t: KesimTalebi) => void;
}

const DURUM_ETIKET: Record<string, string> = {
  bekliyor: "Bekliyor",
  kesimde: "Kısmen kesildi",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};

const DURUM_RENK: Record<string, string> = {
  bekliyor: "bg-amber-50 text-amber-700 border-amber-300",
  kesimde: "bg-blue-50 text-blue-700 border-blue-300",
  tamamlandi: "bg-emerald-50 text-emerald-700 border-emerald-300",
  iptal: "bg-muted text-muted-foreground",
};

export function TalepListesi({ talepler, kesimeBaslaGoster, onKesimeBasla }: Props) {
  const router = useRouter();
  const [islenen, setIslenen] = useState<string | null>(null);

  if (talepler.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <PackageCheck className="mx-auto mb-2 size-6 opacity-40" />
        <p>Bekleyen kesim talebi yok.</p>
      </Card>
    );
  }

  const iptal = async (talepId: string) => {
    setIslenen(talepId);
    const r = await iptalKesimTalebi(talepId);
    setIslenen(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Talep iptal edildi");
    router.refresh();
  };

  const sil = async (talepId: string) => {
    setIslenen(talepId);
    const r = await silKesimTalebi(talepId);
    setIslenen(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Talep silindi");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {talepler.map((t) => {
        const acil = t.oncelik === "acil";
        const kismi = t.kesilen_adet > 0 && t.kalan_adet > 0;
        return (
          <Card
            key={t.talep_id}
            className={cn(
              "p-3",
              acil && "border-l-4 border-l-red-500 bg-red-50/30"
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {acil && (
                    <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                      <Flame className="mr-1 size-3" />
                      Acil
                    </Badge>
                  )}
                  <span className="font-medium">{t.plaka_adi ?? t.plaka_id}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {t.plaka_id}
                  </span>
                  <Badge variant="outline" className={DURUM_RENK[t.durum]}>
                    {DURUM_ETIKET[t.durum] ?? t.durum}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono">{t.sku}</span>
                  {t.urun_adi ? ` · ${t.urun_adi}` : ""}
                  {t.plaka_tipi ? ` · ${t.plaka_tipi}` : ""}
                  {t.plaka_renk ? ` ${t.plaka_renk}` : ""}
                </p>

                {t.talep_notu && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    &ldquo;{t.talep_notu}&rdquo;
                  </p>
                )}

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.talep_eden_adi ?? t.talep_eden} ·{" "}
                  {new Date(t.created_at).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">
                  {t.kalan_adet}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{t.talep_adet}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {kismi ? `${t.kesilen_adet} kesildi, kalan` : "plaka"}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                {kesimeBaslaGoster && onKesimeBasla && (
                  <Button size="sm" onClick={() => onKesimeBasla(t)}>
                    Kesime Başla
                  </Button>
                )}
                {t.durum === "iptal" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => sil(t.talep_id)}
                    disabled={islenen === t.talep_id}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Sil
                  </Button>
                ) : t.durum === "bekliyor" || t.durum === "kesimde" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => iptal(t.talep_id)}
                    disabled={islenen === t.talep_id}
                  >
                    <X className="mr-1 size-3.5" />
                    İptal
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
