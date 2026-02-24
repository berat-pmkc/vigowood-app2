"use client";

import { useEffect, useState } from "react";
import { getPlakaParts } from "../actions";
import { Skeleton } from "@/components/ui/skeleton";

interface PartsPreviewProps {
  plakaId: string | null;
  adet: number;
}

interface PlakaPart {
  ppart_id: string;
  part_id: string;
  part_adi: string;
  default_qty: number;
}

export function PartsPreview({ plakaId, adet }: PartsPreviewProps) {
  const [parts, setParts] = useState<PlakaPart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!plakaId) {
      setParts([]);
      return;
    }

    setLoading(true);
    getPlakaParts(plakaId).then((res) => {
      if (res.success) {
        setParts(res.data);
      }
      setLoading(false);
    });
  }, [plakaId]);

  if (!plakaId) {
    return <div className="text-center py-8 text-muted-foreground">Plaka seçilmedi</div>;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (parts.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Bu plakada parça tanımlanmamış</div>;
  }

  const totalParts = parts.reduce((sum, p) => sum + p.default_qty * adet, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Parça Adı</th>
              <th className="text-center px-3 py-2 font-medium w-20">Birim</th>
              <th className="text-center px-3 py-2 font-medium w-16">×</th>
              <th className="text-center px-3 py-2 font-medium w-20">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.ppart_id} className="border-t">
                <td className="px-3 py-2">
                  <span className="font-medium">{part.part_adi}</span>
                  <span className="text-xs text-muted-foreground ml-1">({part.part_id})</span>
                </td>
                <td className="text-center px-3 py-2 tabular-nums">{part.default_qty}</td>
                <td className="text-center px-3 py-2 text-muted-foreground">× {adet}</td>
                <td className="text-center px-3 py-2 font-semibold tabular-nums">
                  {part.default_qty * adet}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td className="px-3 py-2 font-semibold" colSpan={3}>Toplam Parça</td>
              <td className="text-center px-3 py-2 font-bold tabular-nums">{totalParts}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
