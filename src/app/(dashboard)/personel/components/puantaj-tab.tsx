"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPuantaj, type PuantajSonuc, type PuantajDurum } from "../actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarDays, Search, Users, UserX, CalendarCheck } from "lucide-react";

function buAy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Hücre görünümü: sembol + renk */
const HUCRE: Record<PuantajDurum, { sembol: string; sinif: string; etiket: string }> = {
  geldi: { sembol: "✓", sinif: "bg-emerald-100 text-emerald-700", etiket: "Geldi" },
  devamsiz: { sembol: "✕", sinif: "bg-red-100 text-red-600", etiket: "Devamsız" },
  izinli: { sembol: "İ", sinif: "bg-amber-100 text-amber-700", etiket: "İzinli" },
  raporlu: { sembol: "R", sinif: "bg-sky-100 text-sky-700", etiket: "Raporlu" },
};

function dkSaat(dk: number) {
  const s = Math.floor(dk / 60);
  const d = dk % 60;
  return d ? `${s}s ${d}dk` : `${s}s`;
}

export function PuantajTab() {
  const [ay, setAy] = useState(buAy);
  const [veri, setVeri] = useState<PuantajSonuc | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [departman, setDepartman] = useState("hepsi");

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getPuantaj(ay)
      .then((d) => !iptal && setVeri(d))
      .catch(() => toast.error("Puantaj yüklenemedi"))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, [ay]);

  const departmanlar = useMemo(() => {
    const set = new Set<string>();
    veri?.satirlar.forEach((s) => set.add(s.department ?? s.station ?? "—"));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [veri]);

  const gosterilen = useMemo(() => {
    if (!veri) return [];
    const q = arama.trim().toLocaleLowerCase("tr");
    return veri.satirlar
      .filter((s) => {
        const dep = s.department ?? s.station ?? "—";
        if (departman !== "hepsi" && dep !== departman) return false;
        if (q && !s.full_name.toLocaleLowerCase("tr").includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.department ?? a.station ?? "—";
        const db = b.department ?? b.station ?? "—";
        return da === db
          ? a.full_name.localeCompare(b.full_name, "tr")
          : da.localeCompare(db, "tr");
      });
  }, [veri, arama, departman]);

  const ozet = useMemo(() => {
    const rows = gosterilen;
    const kisi = rows.length;
    const isGunu = veri?.gunler.length ?? 0;
    const toplamDevamsiz = rows.reduce((t, r) => t + r.devamsiz, 0);
    const toplamBeklenen = rows.reduce((t, r) => t + r.toplamGun, 0);
    const toplamGeldi = rows.reduce((t, r) => t + r.geldi, 0);
    const oran = toplamBeklenen ? Math.round((toplamGeldi / toplamBeklenen) * 100) : 0;
    return { kisi, isGunu, toplamDevamsiz, oran };
  }, [gosterilen, veri]);

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="month"
            value={ay}
            onChange={(e) => setAy(e.target.value || buAy())}
            className="h-9 w-[160px] pl-8"
          />
        </div>
        <Select value={departman} onValueChange={setDepartman}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Departman" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hepsi">Tüm departmanlar</SelectItem>
            {departmanlar.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="İsim ara…"
            className="h-9 w-[180px] pl-8"
          />
        </div>

        {/* Efsane */}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {(Object.keys(HUCRE) as PuantajDurum[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold", HUCRE[k].sinif)}>
                {HUCRE[k].sembol}
              </span>
              {HUCRE[k].etiket}
            </span>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex items-center gap-3 p-3">
          <CalendarCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-xl font-bold">{ozet.isGunu}</div>
            <div className="text-xs text-muted-foreground">İş günü</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-xl font-bold">{ozet.kisi}</div>
            <div className="text-xs text-muted-foreground">Personel</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3">
          <UserX className="h-5 w-5 text-red-500" />
          <div>
            <div className="text-xl font-bold text-red-600">{ozet.toplamDevamsiz}</div>
            <div className="text-xs text-muted-foreground">Toplam devamsız gün</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3">
          <div
            className={cn(
              "text-xl font-bold",
              ozet.oran >= 90 ? "text-emerald-600" : ozet.oran >= 75 ? "text-amber-600" : "text-red-600"
            )}
          >
            %{ozet.oran}
          </div>
          <div className="text-xs text-muted-foreground">Ortalama devam</div>
        </Card>
      </div>

      {/* Çizelge */}
      {yukleniyor ? (
        <Skeleton className="h-96 w-full" />
      ) : !veri || veri.gunler.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Bu ay için yoklama kaydı bulunmuyor.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 z-20 min-w-[190px] bg-muted/40 px-3 py-2 text-left font-semibold">
                    Personel
                  </th>
                  {veri.gunler.map((g) => (
                    <th
                      key={g.tarih}
                      className={cn(
                        "w-9 min-w-9 px-0 py-1 text-center font-medium",
                        g.cumartesi && "bg-amber-50"
                      )}
                      title={g.tarih}
                    >
                      <div className="text-[13px] leading-none">{g.gun}</div>
                      <div className="text-[9px] leading-tight text-muted-foreground">{g.haftaGunu}</div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 min-w-[150px] bg-muted/40 px-3 py-2 text-center font-semibold">
                    Özet
                  </th>
                </tr>
              </thead>
              <tbody>
                {gosterilen.map((s) => (
                  <tr key={s.user_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="sticky left-0 z-10 min-w-[190px] bg-white px-3 py-1.5">
                      <div className="font-medium leading-tight text-vw-dark">{s.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.department ?? s.station ?? "—"}
                      </div>
                    </td>
                    {veri.gunler.map((g) => {
                      const durum = s.hucreler[g.tarih] ?? "devamsiz";
                      const h = HUCRE[durum];
                      return (
                        <td key={g.tarih} className={cn("px-0 py-1 text-center", g.cumartesi && "bg-amber-50/40")}>
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                              h.sinif
                            )}
                            title={`${g.tarih} — ${h.etiket}`}
                          >
                            {h.sembol}
                          </span>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 min-w-[150px] bg-white px-3 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          {s.geldi} geldi
                        </Badge>
                        {s.devamsiz > 0 && (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
                            {s.devamsiz} yok
                          </Badge>
                        )}
                      </div>
                      {(s.izinli > 0 || s.raporlu > 0 || s.toplamMesaiDk > 0) && (
                        <div className="mt-0.5 text-center text-[10px] text-muted-foreground">
                          {s.izinli > 0 && `${s.izinli} izin `}
                          {s.raporlu > 0 && `${s.raporlu} rapor `}
                          {s.toplamMesaiDk > 0 && `· ${dkSaat(s.toplamMesaiDk)}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {veri && veri.tatiller.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Resmî tatiller (iş gününe sayılmaz):{" "}
          {veri.tatiller.map((t) => `${t.tarih} ${t.ad}`).join(", ")}
        </p>
      )}
    </div>
  );
}
