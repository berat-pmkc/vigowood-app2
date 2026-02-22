"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface PackageReadyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageReadyDialog({ open, onOpenChange }: PackageReadyDialogProps) {
  const [data, setData] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getPackageReadyStock().then((result) => {
        if (result.success) setData(result.data);
        setLoading(false);
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Paketlemeye Hazır Stok
            {data.length > 0 && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs ml-2">
                {data.length} Ürün
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Yükleniyor...
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
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
                  {data.map((item) => (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
