"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Check,
  X,
  ArrowRight,
} from "lucide-react";

interface SummaryData {
  satisCount: number;
  maliyetCount: number;
  hasSatis: boolean;
  hasMaliyet: boolean;
  hasKarlilik: boolean;
  toplamGelir: number;
  toplamGider: number;
  favok: number;
  genelKar: number;
}

interface Props {
  summary: SummaryData;
  donemLabel: string;
  hasDonem: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function OzetTab({ summary, donemLabel, hasDonem }: Props) {
  if (!hasDonem) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Receipt className="h-16 w-16 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          Henuz donem olusturulmamis. Sag ustteki &quot;+&quot; butonuyla yeni donem olusturun.
        </p>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Toplam Gelir",
      value: formatCurrency(summary.toplamGelir),
      icon: DollarSign,
      color: "text-vw-success",
      bg: "bg-vw-success/10",
    },
    {
      title: "Toplam Gider",
      value: formatCurrency(summary.toplamGider),
      icon: TrendingDown,
      color: "text-vw-error",
      bg: "bg-vw-error/10",
    },
    {
      title: "FAVOK",
      value: formatCurrency(summary.favok),
      icon: TrendingUp,
      color: summary.favok >= 0 ? "text-vw-success" : "text-vw-error",
      bg: summary.favok >= 0 ? "bg-vw-success/10" : "bg-vw-error/10",
    },
    {
      title: "Net Kar",
      value: formatCurrency(summary.genelKar),
      icon: Receipt,
      color: summary.genelKar >= 0 ? "text-vw-success" : "text-vw-error",
      bg: summary.genelKar >= 0 ? "bg-vw-success/10" : "bg-vw-error/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                  <p className="truncate text-lg font-bold">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {donemLabel} - Veri Durumu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge
              variant={summary.hasSatis ? "default" : "secondary"}
              className="gap-1 px-3 py-1.5"
            >
              {summary.hasSatis ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Satis ({summary.satisCount} kayit)
            </Badge>
            <Badge
              variant={summary.hasMaliyet ? "default" : "secondary"}
              className="gap-1 px-3 py-1.5"
            >
              {summary.hasMaliyet ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Maliyet ({summary.maliyetCount} kayit)
            </Badge>
            <Badge
              variant={summary.hasKarlilik ? "default" : "secondary"}
              className="gap-1 px-3 py-1.5"
            >
              {summary.hasKarlilik ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Karlilik
            </Badge>
          </div>

          {summary.hasKarlilik && (
            <div className="mt-4">
              <Link href="/muhasebe/faaliyet/karlilik">
                <Button variant="outline" size="sm">
                  Karlilik Detayi
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
