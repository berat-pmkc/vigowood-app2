"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KesimTalebi } from "../actions";
import { ClipboardList, Flame, ArrowRight } from "lucide-react";

/**
 * Kesimhane ekranının üstünde bekleyen talepleri özetler.
 * Detay ve işlem talepler sayfasında; burada amaç "ne bekliyor" sorusunu
 * ekrana girer girmez cevaplamak.
 */
interface Props {
  talepler: KesimTalebi[];
  /** Bir talep seçilince kesim formunu o talep için açar */
  onKesimeBasla?: (t: KesimTalebi) => void;
}

export function AcikTalepSeridi({ talepler, onKesimeBasla }: Props) {
  if (talepler.length === 0) return null;

  const acilSayisi = talepler.filter((t) => t.oncelik === "acil").length;
  const toplamPlaka = talepler.reduce((s, t) => s + t.kalan_adet, 0);

  return (
    <Card className="border-amber-300 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardList className="size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Talep edilen kesim listesi
            <span className="ml-2 font-normal text-muted-foreground">
              {talepler.length} talep · {toplamPlaka} plaka
            </span>
            {acilSayisi > 0 && (
              <Badge
                variant="outline"
                className="ml-2 border-red-300 bg-red-50 text-red-700"
              >
                <Flame className="mr-1 size-3" />
                {acilSayisi} acil
              </Badge>
            )}
          </p>

          {onKesimeBasla && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Kesime başlamak için plakaya tıklayın — form talep bilgileriyle dolu açılır.
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {talepler.slice(0, 6).map((t) => (
              <button
                key={t.talep_id}
                type="button"
                onClick={() => onKesimeBasla?.(t)}
                disabled={!onKesimeBasla}
                title={onKesimeBasla ? "Bu talep için kesim başlat" : undefined}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <Badge
                  variant="outline"
                  className={
                    (t.oncelik === "acil"
                      ? "border-red-300 bg-white font-normal text-red-700"
                      : "bg-white font-normal") +
                    (onKesimeBasla ? " cursor-pointer hover:bg-amber-100" : "")
                  }
                >
                  {t.plaka_adi ?? t.plaka_id}
                  <span className="ml-1 font-semibold tabular-nums">{t.kalan_adet}</span>
                </Badge>
              </button>
            ))}
            {talepler.length > 6 && (
              <Badge variant="outline" className="bg-white font-normal">
                +{talepler.length - 6} daha
              </Badge>
            )}
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="shrink-0 bg-white">
          <Link href="/uretim/kesim/talepler">
            Listeyi aç
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
