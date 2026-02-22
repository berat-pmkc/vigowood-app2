"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, CheckCircle2, Clock } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ODEME_DURUM_COLORS, type OdemeDurumuConst } from "@/lib/constants";
import { toggleGirisTakipDurum, deleteGirisTakip } from "../actions";
import { NakitGirisTakipFormSheet } from "./nakit-giris-takip-form";
import { toast } from "sonner";

interface GirisTakipRow {
  id: string;
  tanimi: string;
  tutar: number;
  cinsi: string | null;
  tarih: string | null;
  turu: string | null;
  marka: string | null;
  odeme_durum: string | null;
}

function DurumBadge({ durum }: { durum: string | null }) {
  if (!durum) return <span className="text-muted-foreground">—</span>;
  const colors = ODEME_DURUM_COLORS[durum as OdemeDurumuConst];
  if (!colors) return <span className="text-sm">{durum}</span>;
  return (
    <Badge variant="outline" className={`${colors.bg} ${colors.text} border-0 font-medium`}>
      {durum === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
    </Badge>
  );
}

export function NakitGirisTakipTab({ data }: { data: GirisTakipRow[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GirisTakipRow | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = async (id: string, currentDurum: string | null) => {
    const newDurum = currentDurum === "TAMAMLANDI" ? "BEKLİYOR" : "TAMAMLANDI";
    startTransition(async () => {
      const result = await toggleGirisTakipDurum(id, newDurum as "TAMAMLANDI" | "BEKLİYOR");
      if (result.success) {
        toast.success("Durum güncellendi");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    const result = await deleteGirisTakip(id);
    if (result.success) {
      toast.success("Kayıt silindi");
    } else {
      toast.error(result.error);
    }
  };

  const bekleyenToplam = data
    .filter((r) => r.odeme_durum === "BEKLİYOR")
    .reduce((sum, r) => sum + Number(r.tutar), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Beklenen Alacak: <span className="font-semibold text-foreground">{formatCurrency(bekleyenToplam, "TL")}</span>
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingRecord(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Yeni Alacak
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Beklenen Alacaklar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Henüz kayıt yok.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tanım</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Tutar</th>
                    <th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">Marka</th>
                    <th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">Tarih</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">Durum</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-[200px] truncate px-4 py-2">{row.tanimi}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(
                          Number(row.tutar),
                          (row.cinsi as "TL" | "USD" | "EUR") || "TL"
                        )}
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                        {row.marka || "—"}
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                        {formatDate(row.tarih)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          className="cursor-pointer"
                          onClick={() => handleToggle(row.id, row.odeme_durum)}
                        >
                          <DurumBadge durum={row.odeme_durum} />
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingRecord(row);
                              setSheetOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NakitGirisTakipFormSheet
        open={sheetOpen}
        onOpenChange={() => {
          setSheetOpen(false);
          setEditingRecord(null);
        }}
        editingRecord={editingRecord}
      />
    </div>
  );
}
