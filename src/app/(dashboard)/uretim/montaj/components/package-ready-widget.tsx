"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
import { getPackageReadyStock } from "../actions";

interface ReadyItem {
  sku: string;
  urun_adi: string;
  montajTotal: number;
  paketTotal: number;
  bekleyen: number;
}

export function PackageReadyWidget() {
  const [data, setData] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPackageReadyStock().then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold">Paketlemeye Hazır Stok</h3>
        {data.length > 0 && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs ml-auto">
            {data.length} ürün
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Yükleniyor...
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Paketlemeye hazır ürün yok
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Ürün</th>
                <th className="text-center px-2 py-2 font-medium w-20">Montaj</th>
                <th className="text-center px-2 py-2 font-medium w-20">Paket</th>
                <th className="text-center px-2 py-2 font-medium w-20">Bekleyen</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((item) => (
                <tr key={item.sku} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium text-sm truncate max-w-[180px]">{item.urun_adi}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </td>
                  <td className="text-center px-2 py-2 tabular-nums">{item.montajTotal}</td>
                  <td className="text-center px-2 py-2 tabular-nums">{item.paketTotal}</td>
                  <td className="text-center px-2 py-2">
                    <span className="font-bold tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {item.bekleyen}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
