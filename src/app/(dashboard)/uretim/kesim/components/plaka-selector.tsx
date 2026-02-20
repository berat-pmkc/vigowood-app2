"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Palette } from "lucide-react";

interface Plaka {
  plakalar_id: string;
  plaka_id: string;
  plaka_adi: string;
  sku: string | null;
  tipi: string | null;
  renk: string | null;
  makine_id: string;
  std_kesim_suresi_dk: number | null;
}

interface PlakaSelectorProps {
  plakalar: Plaka[];
  value: string | null;
  onChange: (plakaId: string, plakaAdi: string) => void;
}

export function PlakaSelector({ plakalar, value, onChange }: PlakaSelectorProps) {
  if (plakalar.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Bu makine ve ürün kombinasyonu için plaka bulunamadı
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
      {plakalar.map((plaka) => (
        <Card
          key={plaka.plakalar_id}
          className={cn(
            "p-4 cursor-pointer transition-all border-2",
            value === plaka.plaka_id
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border hover:border-primary/50"
          )}
          onClick={() => onChange(plaka.plaka_id, plaka.plaka_adi)}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-foreground">{plaka.plaka_adi}</p>
              <p className="text-xs text-muted-foreground">{plaka.plaka_id}</p>
            </div>
            {plaka.tipi && (
              <Badge variant="outline" className="text-xs">{plaka.tipi}</Badge>
            )}
          </div>

          <div className="flex gap-3 text-xs text-muted-foreground mt-2">
            {plaka.renk && (
              <span className="flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {plaka.renk}
              </span>
            )}
            {plaka.std_kesim_suresi_dk && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {plaka.std_kesim_suresi_dk} dk
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
