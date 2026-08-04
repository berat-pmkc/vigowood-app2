"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDevamsizlikOzeti, type DevamsizlikSatir } from "../actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarDays, Search, TrendingDown, Users } from "lucide-react";

type SiralamaAlani = "full_name" | "geldi" | "devamsiz" | "izinli" | "raporlu" | "kayitsiz";

function buAy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Devam oranına göre renk — düşük oran dikkat çeksin */
function oranRengi(oran: number) {
  if (oran >= 0.95) return "text-emerald-600";
  if (oran >= 0.85) return "text-amber-600";
  return "text-red-600";
}

export function DevamsizlikTab() {
  const [ay, setAy] = useState(buAy);
  const [satirlar, setSatirlar] = useState<DevamsizlikSatir[]>([]);
  const [hedefGun, setHedefGun] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [sirala, setSirala] = useState<SiralamaAlani>("full_name");

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getDevamsizlikOzeti(ay)
      .then((d) => {
        if (iptal) return;
        setSatirlar(d.satirlar);
        setHedefGun(d.hedef_gun);
      })
      .catch(() => toast.error("Devamsızlık özeti yüklenemedi"))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, [ay]);

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    const suzulmus = q
      ? satirlar.filter(
          (s) =>
            s.full_name.toLocaleLowerCase("tr").includes(q) ||
            s.employee.toLocaleLowerCase("tr").includes(q)
        )
      : satirlar;

    return [...suzulmus].sort((a, b) =>
      sirala === "full_name"
        ? a.full_name.localeCompare(b.full_name, "tr")
        : (b[sirala] as number) - (a[sirala] as number)
    );
  }, [satirlar, arama, sirala]);

  const toplam = useMemo(() => {
    const t = (k: keyof DevamsizlikSatir) =>
      satirlar.reduce((s, r) => s + (r[k] as number), 0);
    return {
      kisi: satirlar.length,
      geldi: t("geldi"),
      izinli: t("izinli"),
      raporlu: t("raporlu"),
      devamsiz: t("devamsiz"),
    };
  }, [satirlar]);

  const baslik = (etiket: string, alan: SiralamaAlani, className?: string) => (
    <th
      className={cn(
        "px-2 py-2 font-semibold cursor-pointer select-none hover:text-foreground",
        sirala === alan ? "text-foreground" : "text-muted-foreground",
        className
      )}
      onClick={() => setSirala(alan)}
    >
      {etiket}
      {sirala === alan ? " ↓" : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Üst çubuk */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Ay</label>
          <Input
            type="month"
            value={ay}
            onChange={(e) => setAy(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <label className="text-xs text-muted-foreground">Personel ara</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ad veya personel kodu"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CalendarDays className="w-3.5 h-3.5" /> Hedef iş günü
          </div>
          <p className="text-2xl font-semibold mt-1">{hedefGun}</p>
          <p className="text-[11px] text-muted-foreground">pazarlar hariç</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Users className="w-3.5 h-3.5" /> Aktif personel
          </div>
          <p className="text-2xl font-semibold mt-1">{toplam.kisi}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Toplam izin</p>
          <p className="text-2xl font-semibold mt-1 text-blue-600">{toplam.izinli}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Toplam rapor</p>
          <p className="text-2xl font-semibold mt-1 text-amber-600">{toplam.raporlu}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingDown className="w-3.5 h-3.5" /> Devamsızlık
          </div>
          <p className="text-2xl font-semibold mt-1 text-red-600">{toplam.devamsiz}</p>
        </Card>
      </div>

      {/* Tablo */}
      {yukleniyor ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      ) : gosterilen.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Bu ay için kayıt bulunamadı.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-left">
                {baslik("Personel", "full_name")}
                <th className="px-2 py-2 font-semibold text-muted-foreground">İstasyon</th>
                {baslik("Çalıştığı gün", "geldi", "text-center")}
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">
                  Devam oranı
                </th>
                {baslik("İzinli", "izinli", "text-center")}
                {baslik("Raporlu", "raporlu", "text-center")}
                {baslik("Devamsız", "devamsiz", "text-center")}
                {baslik("Kayıtsız", "kayitsiz", "text-center")}
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">
                  Toplam mesai
                </th>
              </tr>
            </thead>
            <tbody>
              {gosterilen.map((s) => {
                const oran = hedefGun > 0 ? s.geldi / hedefGun : 0;
                const saat = Math.floor(s.toplam_mesai_dk / 60);
                const dk = s.toplam_mesai_dk % 60;
                return (
                  <tr key={s.employee} className="border-b hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <span className="font-medium">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground ml-2 font-mono">
                        {s.employee}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground text-xs">
                      {s.station ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold tabular-nums">
                      {s.geldi}
                      <span className="text-muted-foreground font-normal">/{hedefGun}</span>
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-center font-semibold tabular-nums",
                        oranRengi(oran)
                      )}
                    >
                      %{Math.round(oran * 100)}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {s.izinli > 0 ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          {s.izinli}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {s.raporlu > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          {s.raporlu}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {s.devamsiz > 0 ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          {s.devamsiz}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                      {s.kayitsiz > 0 ? s.kayitsiz : "—"}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                      {s.toplam_mesai_dk > 0 ? `${saat}s ${dk}dk` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium">Kayıtsız</span> sütunu, hedef iş günü sayısından
        yoklaması girilmiş günler düşüldüğünde kalan günleri gösterir — ne gelinmiş ne de
        mazeret kaydedilmiş günler. Hedef gün sayısı ayın pazarları düşülerek hesaplanır,
        resmi tatiller dahil değildir.
      </p>
    </div>
  );
}
