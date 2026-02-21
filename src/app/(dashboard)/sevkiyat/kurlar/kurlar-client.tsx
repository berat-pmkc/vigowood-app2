"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchKurFromApi, type DovizKuruRow } from "../actions";
import { ArrowLeft, Coins, Loader2, RefreshCw, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface KurlarClientProps {
  kurlar: DovizKuruRow[];
}

export function KurlarClient({ kurlar }: KurlarClientProps) {
  const router = useRouter();
  const [apiLoading, setApiLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // En güncel kur (bugünkü veya en son)
  const todayKur = kurlar.find((k) => k.tarih === today);
  const latestKur = kurlar[0]; // Sıralı geldiği için ilk eleman en güncel

  // Sayfa açıldığında bugünün kuru yoksa otomatik çek
  useEffect(() => {
    if (!todayKur) {
      handleFetchFromApi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchFromApi = async () => {
    setApiLoading(true);
    const result = await fetchKurFromApi();
    if (result.success) {
      toast.success("Kurlar Frankfurter API'den güncellendi");
      router.refresh();
    } else {
      toast.error(result.error ?? "API hatası");
    }
    setApiLoading(false);
  };

  const displayKur = todayKur ?? latestKur;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sevkiyat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Coins className="w-6 h-6" />
            Döviz Kurları
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Her gün 12:00'de otomatik güncellenir (Frankfurter API)
          </p>
        </div>
        <Button
          onClick={handleFetchFromApi}
          disabled={apiLoading}
          variant="default"
          className="gap-2"
        >
          {apiLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Şimdi Güncelle</span>
        </Button>
      </div>

      {/* Güncel Kur Kartı */}
      {displayKur && (
        <Card className={todayKur ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Globe className={`w-4 h-4 ${todayKur ? "text-emerald-600" : "text-amber-600"}`} />
              <span className={`text-sm font-medium ${todayKur ? "text-emerald-700" : "text-amber-700"}`}>
                {todayKur ? "Güncel Kurlar" : "Son Kurlar"} — {formatDate(displayKur.tarih)}
              </span>
              {!todayKur && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                  Bugün henüz güncellenmedi
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] ml-auto">
                {displayKur.kaynak === "frankfurter" ? "API" : displayKur.kaynak}
              </Badge>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">USD/TRY</p>
                <p className="text-lg font-bold tabular-nums">{displayKur.usd_try?.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">EUR/TRY</p>
                <p className="text-lg font-bold tabular-nums">{displayKur.eur_try?.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">GBP/TRY</p>
                <p className="text-lg font-bold tabular-nums">{displayKur.gbp_try?.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">PLN/TRY</p>
                <p className="text-lg font-bold tabular-nums">{displayKur.pln_try?.toFixed(4) ?? "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">SEK/TRY</p>
                <p className="text-lg font-bold tabular-nums">{displayKur.sek_try?.toFixed(4) ?? "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2 pt-2 border-t border-emerald-200/50">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">EUR/USD</p>
                <p className="text-sm font-semibold tabular-nums">{displayKur.eur_usd?.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">GBP/USD</p>
                <p className="text-sm font-semibold tabular-nums">{displayKur.gbp_usd?.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">GBP/EUR</p>
                <p className="text-sm font-semibold tabular-nums">{displayKur.gbp_eur?.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kur Geçmişi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Kur Geçmişi (Son 60 Gün)</CardTitle>
        </CardHeader>
        <CardContent>
          {kurlar.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz kur verisi yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Tarih</th>
                    <th className="text-right py-2 px-2">USD/TRY</th>
                    <th className="text-right py-2 px-2">EUR/TRY</th>
                    <th className="text-right py-2 px-2">GBP/TRY</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">PLN/TRY</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">SEK/TRY</th>
                    <th className="text-right py-2 px-2 hidden md:table-cell">EUR/USD</th>
                    <th className="text-right py-2 pl-2">Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  {kurlar.map((kur) => (
                    <tr key={kur.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{formatDate(kur.tarih)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{kur.usd_try?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{kur.eur_try?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{kur.gbp_try?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{kur.pln_try?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{kur.sek_try?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">{kur.eur_usd?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 pl-2 text-right">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            kur.kaynak === "frankfurter"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : ""
                          }`}
                        >
                          {kur.kaynak === "frankfurter" ? "API" : kur.kaynak}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
