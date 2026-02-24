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
import { formatTRY } from "@/lib/ikas/helpers";

interface SkuOption {
  sku: string;
  name: string;
}

interface DayEntry {
  date: string;
  orders: number;
  revenue: number;
}

interface Props {
  skuDailyData: Record<string, DayEntry[]>;
  availableSkus: SkuOption[];
}

const SKU_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export default function SkuFilterChart({ skuDailyData, availableSkus }: Props) {
  // Default to "TÜMÜ" if available
  const [selectedSkus, setSelectedSkus] = useState<string[]>(
    availableSkus.some((s) => s.sku === "TÜMÜ") ? ["TÜMÜ"] : []
  );
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [open, setOpen] = useState(false);

  const chartData = useMemo(() => {
    if (selectedSkus.length === 0) return [];

    const firstSku = selectedSkus[0];
    const template = skuDailyData[firstSku] || [];

    return template.map((day, i) => {
      const entry: Record<string, string | number> = { date: day.date };
      for (const sku of selectedSkus) {
        const data = skuDailyData[sku]?.[i];
        entry[sku] = data ? data[metric] : 0;
      }
      return entry;
    });
  }, [selectedSkus, metric, skuDailyData]);

  function toggleSku(sku: string) {
    setSelectedSkus((prev) =>
      prev.includes(sku)
        ? prev.filter((s) => s !== sku)
        : [...prev, sku].slice(0, 5)
    );
  }

  function removeSku(sku: string) {
    setSelectedSkus((prev) => prev.filter((s) => s !== sku));
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              SKU Seç ({selectedSkus.length}/5)
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="SKU veya ürün adı..." />
              <CommandList>
                <CommandEmpty>SKU bulunamadı.</CommandEmpty>
                <CommandGroup>
                  {availableSkus.map((s) => (
                    <CommandItem
                      key={s.sku}
                      value={`${s.sku} ${s.name}`}
                      onSelect={() => toggleSku(s.sku)}
                    >
                      <span className="font-mono text-xs">{s.sku}</span>
                      <span className="ml-2 truncate text-xs text-muted-foreground">
                        {s.name}
                      </span>
                      {selectedSkus.includes(s.sku) && (
                        <span className="ml-auto text-emerald-600">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex gap-1">
          <Button
            variant={metric === "revenue" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMetric("revenue")}
          >
            Ciro
          </Button>
          <Button
            variant={metric === "orders" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMetric("orders")}
          >
            Adet
          </Button>
        </div>
      </div>

      {/* Selected SKU badges */}
      {selectedSkus.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSkus.map((sku, i) => (
            <Badge
              key={sku}
              variant="outline"
              className="gap-1 pr-1"
              style={{ borderColor: SKU_COLORS[i % SKU_COLORS.length] }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SKU_COLORS[i % SKU_COLORS.length] }}
              />
              {sku}
              <button
                onClick={() => removeSku(sku)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Chart */}
      {selectedSkus.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Grafik için bir veya birden fazla SKU seçin (en fazla 5)
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
            {selectedSkus.map((sku, i) => (
              <Bar
                key={sku}
                dataKey={sku}
                name={sku}
                fill={SKU_COLORS[i % SKU_COLORS.length]}
                radius={[2, 2, 0, 0]}
                barSize={selectedSkus.length > 3 ? 8 : 16}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
