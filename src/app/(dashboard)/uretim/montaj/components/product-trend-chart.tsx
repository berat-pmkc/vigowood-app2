"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Check, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStepTrend } from "../actions";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface ProductTrendChartProps {
  products: ProductOption[];
}

interface TrendRow {
  session_id: string;
  end_time: string | null;
  qty: number | null;
  birim_montaj_dk: number | null;
  worker_count: number | null;
  step_name: string | null;
}

interface DailyData {
  date: string;
  avgBirimDk: number;
  totalQty: number;
}

export function ProductTrendChart({ products }: ProductTrendChartProps) {
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [rawData, setRawData] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSku) {
      setRawData([]);
      return;
    }
    setLoading(true);
    getStepTrend(selectedSku, 60).then((result) => {
      if (result.success) setRawData(result.data);
      setLoading(false);
    });
  }, [selectedSku]);

  const chartData = useMemo(() => {
    const dayMap = new Map<string, { totalBirim: number; count: number; totalQty: number }>();

    for (const row of rawData) {
      if (!row.end_time) continue;
      const day = row.end_time.split("T")[0];
      const existing = dayMap.get(day);
      const birim = Number(row.birim_montaj_dk) || 0;
      const qty = Number(row.qty) || 0;

      if (existing) {
        if (birim > 0) {
          existing.totalBirim += birim;
          existing.count += 1;
        }
        existing.totalQty += qty;
      } else {
        dayMap.set(day, {
          totalBirim: birim > 0 ? birim : 0,
          count: birim > 0 ? 1 : 0,
          totalQty: qty,
        });
      }
    }

    const result: DailyData[] = [];
    for (const [date, v] of dayMap) {
      result.push({
        date,
        avgBirimDk: v.count > 0 ? Math.round((v.totalBirim / v.count) * 100) / 100 : 0,
        totalQty: v.totalQty,
      });
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [rawData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-vw-primary" />
          <h3 className="text-sm font-semibold">Montaj Trend</h3>
        </div>

        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              size="sm"
              className="h-8 w-48 justify-between text-xs"
            >
              <span className="truncate">
                {selectedSku
                  ? products.find((p) => p.sku === selectedSku)?.urun_adi ?? selectedSku
                  : "Ürün seç..."}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Ürün ara..." />
              <CommandList>
                <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem
                      key={p.sku}
                      value={`${p.sku} ${p.urun_adi}`}
                      onSelect={() => {
                        setSelectedSku(p.sku);
                        setComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedSku === p.sku ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-xs truncate">{p.sku}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {!selectedSku ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Trend grafiğini görmek için bir ürün seçin
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Bu ürün için henüz trend verisi yok
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="montajGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#cdbd9d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#cdbd9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{ value: "dk/birim", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value: number | string | undefined, name: string | undefined) => {
                  if (name === "avgBirimDk") return [`${value ?? 0} dk`, "Ort. Birim Süre"];
                  return [`${value ?? 0} adet`, "Toplam Adet"];
                }}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="avgBirimDk"
                stroke="#cdbd9d"
                strokeWidth={2}
                fill="url(#montajGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
