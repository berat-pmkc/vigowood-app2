"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, Calculator, Clock, Package, Puzzle, TrendingUp, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  updateSettings,
  calculateCriticalStock,
  type AppSettings,
  type KritikStokSummary,
} from "../actions";

interface Props {
  initialSettings: AppSettings;
}

export function AyarlarClient({ initialSettings }: Props) {
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();
  const [isCalculating, setIsCalculating] = useState(false);

  const [gun, setGun] = useState(initialSettings.kritik_stok_gun);
  const [lookback, setLookback] = useState(initialSettings.kritik_stok_lookback_days);
  const [summary, setSummary] = useState<KritikStokSummary | null>(
    initialSettings.kritik_stok_last_summary
  );
  const [lastCalculated, setLastCalculated] = useState<string | null>(
    initialSettings.kritik_stok_last_calculated
  );

  function handleSave() {
    startSaveTransition(async () => {
      const result = await updateSettings({
        kritik_stok_gun: gun,
        kritik_stok_lookback_days: lookback,
      });

      if (result.success) {
        toast.success("Ayarlar kaydedildi");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleCalculate() {
    setIsCalculating(true);
    try {
      const result = await calculateCriticalStock();
      if (result.success) {
        setSummary(result.summary);
        setLastCalculated(result.summary.calculated_at);
        toast.success(
          `Kritik stoklar hesaplandı: ${result.summary.updated_products} ürün, ${result.summary.updated_parts} parça güncellendi`
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setIsCalculating(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "Henüz hesaplanmadı";
    try {
      return new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Kart 1: Kritik Stok Ayarları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Kritik Stok Ayarları
          </CardTitle>
          <CardDescription>
            Kritik stok eşiği hesaplamasında kullanılan parametreler
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kritik-gun">Kritik Stok Gün Sayısı</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kritik-gun"
                type="number"
                min={1}
                max={365}
                value={gun}
                onChange={(e) => setGun(Number(e.target.value) || 1)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">gün</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Günlük satış hızı x bu gün sayısı = ürün kritik stok eşiği
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lookback-days">Geriye Bakış Süresi</Label>
            <div className="flex items-center gap-2">
              <Input
                id="lookback-days"
                type="number"
                min={7}
                max={365}
                value={lookback}
                onChange={(e) => setLookback(Number(e.target.value) || 7)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">gün</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Günlük satış hızı hesabında son kaç günün verisi kullanılır
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              "Ayarları Kaydet"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Kart 2: Hesaplama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            Kritik Stok Hesaplama
          </CardTitle>
          <CardDescription>
            Satış verisine dayalı otomatik kritik stok eşiği hesaplama
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-medium">Hesaplama adımları:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Son {lookback} günün satış verisi analiz edilir</li>
              <li>Her ürün için günlük satış hızı hesaplanır</li>
              <li>Ürün kritik stok = günlük satış x {gun} gün</li>
              <li>BOM üzerinden parça kritik stokları türetilir</li>
            </ol>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Son hesaplama: {formatDate(lastCalculated)}</span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                className="w-full"
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Hesaplanıyor...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Kritik Stokları Hesapla
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Kritik Stokları Yeniden Hesapla
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Bu işlem tüm aktif ürünlerin ve parçaların kritik stok eşiklerini
                  satış verisine göre yeniden hesaplayacaktır. Mevcut elle girilen
                  değerlerin üzerine yazılacaktır.
                  <br />
                  <br />
                  <strong>Parametreler:</strong> Son {lookback} gün satış verisi,{" "}
                  {gun} gün kritik stok süresi
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction onClick={handleCalculate}>
                  Hesapla
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Kart 3: Son Hesaplama Sonuçları (tam genişlik) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Son Hesaplama Sonuçları
          </CardTitle>
          <CardDescription>
            {summary
              ? `${formatDate(summary.calculated_at)} — ${summary.calculated_by} tarafından hesaplandı`
              : "Henüz hesaplama yapılmadı"}
          </CardDescription>
        </CardHeader>
        {summary && (
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                icon={Package}
                label="Güncellenen Ürünler"
                value={`${summary.updated_products} / ${summary.total_products}`}
                sublabel={`${summary.products_with_sales} satışlı, ${summary.products_without_sales} satışsız`}
                color="text-blue-600"
              />
              <SummaryItem
                icon={Puzzle}
                label="Güncellenen Parçalar"
                value={`${summary.updated_parts} / ${summary.total_parts}`}
                sublabel="BOM üzerinden hesaplandı"
                color="text-emerald-600"
              />
              <SummaryItem
                icon={TrendingUp}
                label="Satışlı Ürün Oranı"
                value={
                  summary.total_products > 0
                    ? `%${Math.round((summary.products_with_sales / summary.total_products) * 100)}`
                    : "%0"
                }
                sublabel={`Son ${lookback} günde satışı var`}
                color="text-amber-600"
              />
              <SummaryItem
                icon={CheckCircle2}
                label="Hesaplama Süresi"
                value={formatDuration(summary.duration_ms)}
                sublabel={formatDate(summary.calculated_at)}
                color="text-purple-600"
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
