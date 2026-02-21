"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSettings,
  type AppSettings,
} from "../actions";

interface Props {
  initialSettings: AppSettings;
}

export function AyarlarClient({ initialSettings }: Props) {
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();

  const [gun, setGun] = useState(initialSettings.kritik_stok_gun);
  const [lookback, setLookback] = useState(initialSettings.kritik_stok_lookback_days);

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

      {/* Kart 2: Otomatik Hesaplama Bilgisi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Otomatik Hesaplama
          </CardTitle>
          <CardDescription>
            Kritik stok eşikleri her gün otomatik olarak güncellenir
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

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>
              Hesaplama her gün saat <strong>12:00</strong>'da otomatik olarak çalışır.
              Yukarıdaki parametreleri değiştirirseniz bir sonraki hesaplamada yeni değerler kullanılır.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
