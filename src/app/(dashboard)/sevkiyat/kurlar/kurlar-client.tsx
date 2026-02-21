"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createKur, type DovizKuruRow } from "../actions";
import { ArrowLeft, Coins, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface KurlarClientProps {
  kurlar: DovizKuruRow[];
}

export function KurlarClient({ kurlar }: KurlarClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [tarih, setTarih] = useState(today);
  const [usdTry, setUsdTry] = useState("");
  const [eurTry, setEurTry] = useState("");
  const [gbpTry, setGbpTry] = useState("");

  // Hesaplanan çapraz kurlar
  const usd = parseFloat(usdTry) || 0;
  const eur = parseFloat(eurTry) || 0;
  const gbp = parseFloat(gbpTry) || 0;

  const eurUsd = usd > 0 ? (eur / usd).toFixed(4) : "—";
  const gbpUsd = usd > 0 ? (gbp / usd).toFixed(4) : "—";
  const gbpEur = eur > 0 ? (gbp / eur).toFixed(4) : "—";

  const handleSave = async () => {
    if (!usd || !eur || !gbp) {
      toast.error("Tüm kurları giriniz");
      return;
    }

    setLoading(true);
    const result = await createKur({
      tarih,
      usd_try: usd,
      eur_try: eur,
      gbp_try: gbp,
    });

    if (result.success) {
      toast.success("Kur kaydedildi");
      router.refresh();
      setUsdTry("");
      setEurTry("");
      setGbpTry("");
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sevkiyat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Coins className="w-6 h-6" />
            Döviz Kurları
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manuel kur girişi ve geçmiş kurlar
          </p>
        </div>
      </div>

      {/* Kur Giriş Formu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Yeni Kur Girişi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tarih</Label>
              <Input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">USD / TRY</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="36.50"
                value={usdTry}
                onChange={(e) => setUsdTry(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">EUR / TRY</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="38.20"
                value={eurTry}
                onChange={(e) => setEurTry(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GBP / TRY</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="45.60"
                value={gbpTry}
                onChange={(e) => setGbpTry(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Çapraz kurlar */}
          {usd > 0 && eur > 0 && gbp > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
              <span>EUR/USD: <b>{eurUsd}</b></span>
              <span>GBP/USD: <b>{gbpUsd}</b></span>
              <span>GBP/EUR: <b>{gbpEur}</b></span>
            </div>
          )}

          <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Kaydet
          </Button>
        </CardContent>
      </Card>

      {/* Kur Geçmişi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Geçmiş Kurlar (Son 60 Gün)</CardTitle>
        </CardHeader>
        <CardContent>
          {kurlar.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz kur girişi yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Tarih</th>
                    <th className="text-right py-2 px-2">USD/TRY</th>
                    <th className="text-right py-2 px-2">EUR/TRY</th>
                    <th className="text-right py-2 px-2">GBP/TRY</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">EUR/USD</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">GBP/USD</th>
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
                      <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{kur.eur_usd?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{kur.gbp_usd?.toFixed(4) ?? "—"}</td>
                      <td className="py-2 pl-2 text-right">
                        <Badge variant="outline" className="text-[10px]">{kur.kaynak}</Badge>
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
