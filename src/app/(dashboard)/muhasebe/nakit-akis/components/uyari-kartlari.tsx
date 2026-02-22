"use client";

import { AlertTriangle, AlertCircle, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface UyariData {
  nakitTl: number;
  toplamBorc: number;
  toplamVarlik: number;
  organikGelir: number;
  prevOrganikGelir?: number;
  kisaVadeliBorc?: number;
}

export function UyariKartlari({ data }: { data: UyariData }) {
  const alerts: { icon: typeof AlertTriangle; title: string; desc: string; color: string }[] = [];

  // Negatif nakit
  if (data.nakitTl < 0) {
    alerts.push({
      icon: AlertCircle,
      title: "Negatif Nakit Pozisyonu",
      desc: `Nakit TL: ${formatCurrency(data.nakitTl, "TL")}`,
      color: "border-red-300 bg-red-50 text-red-800",
    });
  }

  // Kısa vadeli likidite uyarısı (90 gün bekleyen ödemeler vs nakit TL)
  if (data.kisaVadeliBorc != null && data.kisaVadeliBorc > 0 && data.nakitTl > 0) {
    const oran = (data.kisaVadeliBorc / data.nakitTl) * 100;
    if (oran > 80) {
      alerts.push({
        icon: AlertTriangle,
        title: "Kısa Vadeli Likidite Uyarısı",
        desc: `90 gün içindeki yükümlülükler nakit rezervinin %${oran.toFixed(0)}'ine ulaştı (${formatCurrency(data.kisaVadeliBorc, "TL")} / ${formatCurrency(data.nakitTl, "TL")})`,
        color: "border-amber-300 bg-amber-50 text-amber-800",
      });
    }
  }

  // Organik gelir düşüşü (>20%)
  if (data.prevOrganikGelir && data.prevOrganikGelir > 0) {
    const dusus = ((data.prevOrganikGelir - data.organikGelir) / data.prevOrganikGelir) * 100;
    if (dusus > 20) {
      alerts.push({
        icon: TrendingDown,
        title: "Organik Gelir Düşüşü",
        desc: `Önceki döneme göre %${dusus.toFixed(1)} düşüş`,
        color: "border-orange-300 bg-orange-50 text-orange-800",
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg border p-3 ${alert.color}`}
        >
          <alert.icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs opacity-80">{alert.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
