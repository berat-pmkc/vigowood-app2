"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Gauge, Coins, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface MontajOzet {
  adet: number;
  dkAdet: number;
  tlAdet: number;
  operatorSayisi: number;
  saat: number;
}
export interface MontajOperator {
  ad: string;
  adet: number;
  saat: number;
  dkAdet: number;
}
export interface MontajGun {
  tarih: string; // YYYY-MM-DD
  adet: number;
}

// Verim rengi: düşük dk/adet = hızlı = yeşil
const verimRenk = (d: number) => (d <= 1.5 ? "#70c1aa" : d <= 3 ? "#f28a19" : "#ee7683");
const gunKisa = (t: string) => {
  const [, m, d] = t.split("-");
  return `${d}.${m}`;
};

function OpTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MontajOperator }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const o = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-sm shadow-md">
      <p className="mb-1 font-medium">{o.ad}</p>
      <p className="text-muted-foreground">Üretim: <span className="font-semibold text-foreground">{formatNumber(o.adet)} adet</span></p>
      <p className="text-muted-foreground">Çalışma: <span className="font-semibold text-foreground">{formatNumber(o.saat)} saat</span></p>
      <p className="text-muted-foreground">Verim: <span className="font-semibold text-foreground">{o.dkAdet} dk/adet</span></p>
    </div>
  );
}

function GunTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-muted-foreground">Montaj: <span className="font-semibold text-foreground">{formatNumber(payload[0].value)} adet</span></p>
    </div>
  );
}

export function MontajAnaliz({
  ozet, operatorler, gunluk,
}: {
  ozet: MontajOzet;
  operatorler: MontajOperator[];
  gunluk: MontajGun[];
}) {
  const kartlar = [
    { t: "Montaj Üretimi", v: formatNumber(ozet.adet), s: "adet (dönem)", i: Factory, bg: "bg-emerald-50", c: "text-vw-success" },
    { t: "Ort. Verim", v: `${ozet.dkAdet} dk`, s: "kişi-dk / adet", i: Gauge, bg: "bg-blue-50", c: "text-vw-info" },
    { t: "İşçilik / adet", v: `₺${ozet.tlAdet.toLocaleString("tr-TR")}`, s: "montaj işçiliği", i: Coins, bg: "bg-amber-50", c: "text-vw-warning" },
    { t: "Aktif Operatör", v: formatNumber(ozet.operatorSayisi), s: `${formatNumber(ozet.saat)} kişi-saat`, i: Users, bg: "bg-purple-50", c: "text-purple-600" },
  ];
  const gunData = gunluk.map((g) => ({ gun: gunKisa(g.tarih), adet: g.adet }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {kartlar.map((k) => (
          <Card key={k.t} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{k.t}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{k.v}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{k.s}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.i className={`h-5 w-5 ${k.c}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Operatör Üretimi</CardTitle>
          <p className="text-xs text-muted-foreground">
            Kimin ne kadar ürettiği (dahil olduğu seansların toplam adedi). Renk = verim: yeşil hızlı, kırmızı yavaş.
          </p>
        </CardHeader>
        <CardContent>
          {operatorler.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu dönemde montaj verisi yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, operatorler.length * 30)}>
              <BarChart data={operatorler} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e1d6" />
                <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ad" width={110} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip content={<OpTip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="adet" radius={[0, 4, 4, 0]}>
                  {operatorler.map((o, i) => (
                    <Cell key={i} fill={verimRenk(o.dkAdet)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Günlük Montaj Çıktısı</CardTitle>
        </CardHeader>
        <CardContent>
          {gunData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu dönemde montaj verisi yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={gunData} margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e1d6" />
                <XAxis dataKey="gun" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip content={<GunTip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="adet" fill="#cdbd9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
