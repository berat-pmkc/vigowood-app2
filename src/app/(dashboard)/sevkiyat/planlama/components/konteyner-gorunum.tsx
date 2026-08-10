"use client";

import { Card } from "@/components/ui/card";
import type { Blok, Konteyner } from "@/lib/packing/types";

/**
 * Konteyner yerleşiminin üstten ve yandan görünümü.
 *
 * Üstten görünüm konteynerin boy-en düzlemi, yandan görünüm boy-yükseklik.
 * Dizilim tablosuyla birlikte okunmalı — görsel nerede olduğunu, tablo
 * kolinin hangi yüzünün nereye geleceğini söylüyor.
 */
export function KonteynerGorunum({
  bloklar,
  kont,
  renkler,
}: {
  bloklar: Blok[];
  kont: Konteyner;
  renkler: Map<string, string>;
}) {
  if (bloklar.length === 0) return null;

  const gorunum = (
    baslik: string,
    yatayUzunluk: number,
    dikeyUzunluk: number,
    konum: (b: Blok) => { x: number; y: number; w: number; h: number },
  ) => {
    // Çizim yüksekliğini genişlik belirler (className'de h-auto w-full).
    // Önce maxHeight:170 kısıtı vardı; görünümün oranı ~5:1 olduğu için
    // kapsayıcı genişledikçe preserveAspectRatio içeriği ortalayıp sağa
    // sola boş şerit bırakıyordu.
    const H = 150;
    const olcek = H / dikeyUzunluk;
    const W = yatayUzunluk * olcek;
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{baslik}</p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full rounded border bg-muted/20"
          preserveAspectRatio="xMidYMid meet"
        >
          {bloklar.map((b, i) => {
            const k = konum(b);
            return (
              <rect
                key={i}
                x={k.x * olcek}
                y={H - (k.y + k.h) * olcek}
                width={Math.max(k.w * olcek, 0.5)}
                height={Math.max(k.h * olcek, 0.5)}
                fill={renkler.get(b.sku) ?? "#bbb"}
                stroke="#fff"
                strokeWidth={0.5}
                opacity={0.9}
              />
            );
          })}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="#666" strokeWidth={1} />
        </svg>
      </div>
    );
  };

  return (
    <Card className="space-y-3 p-3">
      {gorunum("Üstten görünüm — boy × en", kont.uzunluk, kont.genislik, (b) => ({
        x: b.x, y: b.y, w: b.dx, h: b.dy,
      }))}
      {gorunum("Yandan görünüm — boy × yükseklik", kont.uzunluk, kont.yukseklik, (b) => ({
        x: b.x, y: b.z, w: b.dx, h: b.dz,
      }))}
    </Card>
  );
}
