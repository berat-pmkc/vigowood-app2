"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, TrendingDown, Target } from "lucide-react";
import { karMarjiRenk } from "@/lib/pricingCalculator";

interface SummaryData {
  toplamUrun: number;
  ortalamaKarMarji: number;
  zarardaOlan: number;
  hedefUstunde: number;
}

export function PricingSummaryCards({ data }: { data: SummaryData }) {
  const marjClass = karMarjiRenk(data.ortalamaKarMarji);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Toplam Ürün</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.toplamUrun}</div>
          <p className="text-xs text-muted-foreground">aktif listing</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Ort. Kar Marjı</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              %{(data.ortalamaKarMarji * 100).toFixed(1)}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${marjClass}`}>
              {data.ortalamaKarMarji > 0 ? "Kâr" : "Zarar"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Zararda Olan</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{data.zarardaOlan}</div>
          <p className="text-xs text-muted-foreground">kar marjı &lt; 0</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Hedefin Üstünde</CardTitle>
          <Target className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{data.hedefUstunde}</div>
          <p className="text-xs text-muted-foreground">kar marjı &gt; 0</p>
        </CardContent>
      </Card>
    </div>
  );
}
