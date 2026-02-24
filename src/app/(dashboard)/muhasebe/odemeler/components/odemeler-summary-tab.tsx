"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  ODEME_TURLERI,
  ODEME_TURU_LABELS,
  ODEME_TURU_COLORS,
  type OdemeTuruConst,
} from "@/lib/constants";

interface SummaryItem {
  tarih: string | null;
  tutar: number;
  odeme_durum: string | null;
  cinsi: string | null;
  turu: string | null;
}

type ViewMode = "aylik" | "haftalik";

const AY_KISALTMA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  // Find Monday of the week
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mDay = monday.getDate();
  const mMonth = AY_KISALTMA[monday.getMonth()];
  const sDay = sunday.getDate();

  if (monday.getMonth() === sunday.getMonth()) {
    return `${mDay}-${sDay} ${mMonth}`;
  }
  const sMonth = AY_KISALTMA[sunday.getMonth()];
  return `${mDay} ${mMonth}-${sDay} ${sMonth}`;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export function OdemelerSummaryTab({ data }: { data: SummaryItem[] }) {
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<ViewMode>("aylik");
  const [selectedTuru, setSelectedTuru] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const item of data) {
      if (item.tarih) {
        years.add(parseInt(item.tarih.substring(0, 4)));
      }
    }
    // Always include current year
    years.add(currentYear);
    return Array.from(years).sort((a, b) => a - b);
  }, [data, currentYear]);

  // Filter TL only + selected year
  const tlData = useMemo(
    () =>
      data.filter(
        (d) =>
          d.cinsi === "TL" &&
          d.tarih &&
          d.tarih.startsWith(String(selectedYear))
      ),
    [data, selectedYear]
  );

  // Monthly grouped data
  const monthlyData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();

    // Initialize all 12 months for the selected year
    for (let m = 0; m < 12; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
      map.set(key, {});
    }

    for (const item of tlData) {
      if (!item.tarih) continue;
      const monthKey = item.tarih.substring(0, 7);
      if (!map.has(monthKey)) {
        map.set(monthKey, {});
      }
      const entry = map.get(monthKey)!;
      const turu = item.turu || "DİĞER";
      entry[turu] = (entry[turu] || 0) + item.tutar;
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const d = new Date(key + "-01");
        return {
          key,
          label: AY_KISALTMA[d.getMonth()],
          ...values,
        };
      });
  }, [tlData, selectedYear]);

  // Weekly grouped data
  const weeklyData = useMemo(() => {
    const map = new Map<string, { label: string; values: Record<string, number> }>();

    for (const item of tlData) {
      if (!item.tarih) continue;
      const weekKey = getWeekKey(item.tarih);
      if (!map.has(weekKey)) {
        map.set(weekKey, { label: getWeekLabel(item.tarih), values: {} });
      }
      const entry = map.get(weekKey)!;
      const turu = item.turu || "DİĞER";
      entry.values[turu] = (entry.values[turu] || 0) + item.tutar;
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { label, values }]) => ({
        key,
        label,
        ...values,
      }));
  }, [tlData]);

  const chartData = viewMode === "aylik" ? monthlyData : weeklyData;

  // Active turu keys in data
  const activeTuruKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of tlData) {
      if (item.turu) keys.add(item.turu);
    }
    return ODEME_TURLERI.filter((t) => keys.has(t));
  }, [tlData]);

  const canGoPrev = availableYears[0] < selectedYear;
  const canGoNext = selectedYear < availableYears[availableYears.length - 1] || selectedYear < currentYear + 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View mode toggle */}
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button
            size="sm"
            variant={viewMode === "haftalik" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setViewMode("haftalik")}
          >
            Haftalık
          </Button>
          <Button
            size="sm"
            variant={viewMode === "aylik" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setViewMode("aylik")}
          >
            Aylık
          </Button>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setSelectedYear((y) => y - 1)}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {availableYears.map((year) => (
            <Button
              key={year}
              size="sm"
              variant={selectedYear === year ? "default" : "outline"}
              className="h-7 text-xs px-3"
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category filter buttons */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={selectedTuru === null ? "default" : "outline"}
          className="h-7 shrink-0 text-xs"
          onClick={() => setSelectedTuru(null)}
        >
          Tümü
        </Button>
        {activeTuruKeys.map((turu) => {
          const colors = ODEME_TURU_COLORS[turu];
          const isSelected = selectedTuru === turu;
          return (
            <Button
              key={turu}
              size="sm"
              variant="outline"
              className="h-7 shrink-0 border text-xs"
              style={
                isSelected
                  ? { backgroundColor: colors.bg, color: colors.text, borderColor: colors.text }
                  : undefined
              }
              onClick={() => setSelectedTuru(isSelected ? null : turu)}
            >
              {ODEME_TURU_LABELS[turu]}
            </Button>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedTuru
              ? `${ODEME_TURU_LABELS[selectedTuru as OdemeTuruConst]} Trendi — ${selectedYear}`
              : `Ödeme Trendi — ${selectedYear} (${viewMode === "aylik" ? "Aylık" : "Haftalık"})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedTuru ? (
                // Single category trend line
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}K`
                        : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value) => [
                      new Intl.NumberFormat("tr-TR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(Number(value)) + " ₺",
                      ODEME_TURU_LABELS[selectedTuru as OdemeTuruConst],
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey={selectedTuru}
                    stroke={ODEME_TURU_COLORS[selectedTuru as OdemeTuruConst]?.text || "#616161"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              ) : (
                // Stacked bar chart with all categories
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}K`
                        : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      new Intl.NumberFormat("tr-TR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(Number(value)) + " ₺",
                      ODEME_TURU_LABELS[name as OdemeTuruConst] || name,
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      ODEME_TURU_LABELS[value as OdemeTuruConst] || value
                    }
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                  {activeTuruKeys.map((turu, i) => (
                    <Bar
                      key={turu}
                      dataKey={turu}
                      stackId="a"
                      fill={ODEME_TURU_COLORS[turu]?.text || "#616161"}
                      radius={i === activeTuruKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
