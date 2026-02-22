"use client";

import { useState, useEffect } from "react";
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
import { ChevronsUpDown, Check, Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStepPerformance } from "../actions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface StepPerformanceChartProps {
  products: ProductOption[];
}

interface StepData {
  step_name: string;
  seq_no: number;
  avgBirimDk: number;
  sessionCount: number;
}

export function StepPerformanceChart({ products }: StepPerformanceChartProps) {
  const [selectedSku, setSelectedSku] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [data, setData] = useState<StepData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSku) {
      setData([]);
      return;
    }
    setLoading(true);
    getStepPerformance(selectedSku).then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [selectedSku]);

  const totalMinutes = data.reduce((sum, d) => sum + d.avgBirimDk, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-vw-primary" />
          <h3 className="text-sm font-semibold">Adım Performansı</h3>
        </div>

        {/* Product selector */}
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
          Performans grafiğini görmek için bir ürün seçin
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Bu ürün için henüz performans verisi yok
        </p>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  label={{ value: "dk/birim", position: "insideBottomRight", offset: -5, fontSize: 10 }}
                />
                <YAxis
                  dataKey="step_name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number | string | undefined) => [`${value ?? 0} dk`, "Ort. Birim Süre"]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="avgBirimDk"
                  fill="#cdbd9d"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Toplam tahmini üretim süresi (montaj + paketleme): <span className="font-semibold">{Math.round(totalMinutes * 100) / 100} dk/birim</span>
          </p>
        </>
      )}
    </Card>
  );
}
