"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, X, BarChart3 } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { formatTRY } from "@/lib/trendyol/helpers";

interface BarcodeOption {
  barcode: string;
  name: string;
}

interface DayEntry {
  date: string;
  orders: number;
  revenue: number;
}

interface Props {
  barcodeDailyData: Record<string, DayEntry[]>;
  availableBarcodes: BarcodeOption[];
}

const BARCODE_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export default function TrendyolBarcodeChart({ barcodeDailyData, availableBarcodes }: Props) {
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>(
    availableBarcodes.some((s) => s.barcode === "TÜMÜ") ? ["TÜMÜ"] : []
  );
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [open, setOpen] = useState(false);

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    for (const barcode of selectedBarcodes) {
      const entries = barcodeDailyData[barcode] || [];
      for (const e of entries) {
        totalRevenue += e.revenue;
        totalOrders += e.orders;
      }
    }
    return { revenue: totalRevenue, orders: totalOrders };
  }, [selectedBarcodes, barcodeDailyData]);

  const chartData = useMemo(() => {
    if (selectedBarcodes.length === 0) return [];

    const firstBarcode = selectedBarcodes[0];
    const template = barcodeDailyData[firstBarcode] || [];

    return template.map((day, i) => {
      const entry: Record<string, string | number> = { date: day.date };
      for (const barcode of selectedBarcodes) {
        const data = barcodeDailyData[barcode]?.[i];
        entry[barcode] = data ? data[metric] : 0;
      }
      return entry;
    });
  }, [selectedBarcodes, metric, barcodeDailyData]);

  function toggleBarcode(barcode: string) {
    setSelectedBarcodes((prev) =>
      prev.includes(barcode)
        ? prev.filter((s) => s !== barcode)
        : [...prev, barcode].slice(0, 5)
    );
  }

  function removeBarcode(barcode: string) {
    setSelectedBarcodes((prev) => prev.filter((s) => s !== barcode));
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Ürün Seç ({selectedBarcodes.length}/5)
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Barkod veya ürün adı..." />
              <CommandList>
                <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
                <CommandGroup>
                  {availableBarcodes.map((s) => (
                    <CommandItem
                      key={s.barcode}
                      value={`${s.barcode} ${s.name}`}
                      onSelect={() => toggleBarcode(s.barcode)}
                    >
                      <span className="font-mono text-xs">{s.barcode}</span>
                      <span className="ml-2 truncate text-xs text-muted-foreground">
                        {s.name}
                      </span>
                      {selectedBarcodes.includes(s.barcode) && (
                        <span className="ml-auto text-orange-600">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Metric toggle */}
        <div className="flex gap-1">
          <Button
            variant={metric === "revenue" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setMetric("revenue")}
          >
            Ciro
            {selectedBarcodes.length > 0 && (
              <span className="font-semibold">{formatTRY(totals.revenue)}</span>
            )}
          </Button>
          <Button
            variant={metric === "orders" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setMetric("orders")}
          >
            Adet
            {selectedBarcodes.length > 0 && (
              <span className="font-semibold">{totals.orders.toLocaleString("tr-TR")}</span>
            )}
          </Button>
        </div>
      </div>

      {/* Selected barcode badges */}
      {selectedBarcodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedBarcodes.map((barcode, i) => (
            <Badge
              key={barcode}
              variant="outline"
              className="gap-1 pr-1"
              style={{ borderColor: BARCODE_COLORS[i % BARCODE_COLORS.length] }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: BARCODE_COLORS[i % BARCODE_COLORS.length] }}
              />
              {barcode}
              <button
                onClick={() => removeBarcode(barcode)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Chart */}
      {selectedBarcodes.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Grafik için bir veya birden fazla ürün seçin (en fazla 5)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: COLORS.deep }}
              tickLine={false}
              axisLine={{ stroke: COLORS.side, strokeOpacity: 0.3 }}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={
                metric === "revenue"
                  ? (v: number) => `${(v / 1000).toFixed(0)}K`
                  : undefined
              }
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                metric === "revenue" ? formatTRY(Number(value) || 0) : `${Number(value) || 0} adet`,
                String(name),
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: `1px solid ${COLORS.side}`,
                fontSize: "13px",
              }}
            />
            <Legend />
            {selectedBarcodes.map((barcode, i) => (
              <Bar
                key={barcode}
                dataKey={barcode}
                name={barcode}
                fill={BARCODE_COLORS[i % BARCODE_COLORS.length]}
                radius={[2, 2, 0, 0]}
                barSize={selectedBarcodes.length > 3 ? 8 : 16}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
