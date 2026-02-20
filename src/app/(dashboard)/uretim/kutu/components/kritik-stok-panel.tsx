"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface KritikStokItem {
  part_id: string;
  part_adi: string;
  part_type: string;
  hazir_eleman_aktif_stok: number;
  hazir_eleman_kritik_stok: number;
}

interface KritikStokPanelProps {
  items: KritikStokItem[];
}

function getStokLevel(aktif: number, kritik: number): "red" | "yellow" | "green" {
  if (aktif < kritik) return "red";
  if (aktif <= kritik * 1.5) return "yellow";
  return "green";
}

const levelStyles = {
  red: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  yellow: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  green: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export function KritikStokPanel({ items }: KritikStokPanelProps) {
  if (items.length === 0) return null;

  const criticalItems = items.filter(
    (i) => getStokLevel(i.hazir_eleman_aktif_stok, i.hazir_eleman_kritik_stok) !== "green"
  );

  if (criticalItems.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">Kritik Stok Uyarısı</span>
          <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-600">
            {criticalItems.length} parça
          </Badge>
        </div>
        <div className="space-y-2">
          {criticalItems.map((item) => {
            const level = getStokLevel(item.hazir_eleman_aktif_stok, item.hazir_eleman_kritik_stok);
            const styles = levelStyles[level];
            return (
              <div
                key={item.part_id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                  <span className={`truncate font-medium ${styles.text}`}>{item.part_adi}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className={`font-bold tabular-nums ${styles.text}`}>
                    {item.hazir_eleman_aktif_stok}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground tabular-nums">
                    {item.hazir_eleman_kritik_stok}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
