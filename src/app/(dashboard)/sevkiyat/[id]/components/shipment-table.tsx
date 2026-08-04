"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  updateItemPaletSayisi,
  updateItemGrup,
  deleteSevkiyatItem,
} from "../../actions";
import type { SevkiyatItemRow } from "../../actions";
import { X, Check, Pencil } from "lucide-react";
import { EditItemSheet } from "./edit-item-sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShipmentTableProps {
  items: SevkiyatItemRow[];
  isEditable: boolean;
  countryCode: string;
  onItemUpdated: () => void;
  onItemDeleted: (itemId: string) => void;
  totals: {
    palet: number;
    koli: number;
    adet: number;
    agirlik: number;
    hacim: number;
  };
}

export function ShipmentTable({
  items,
  isEditable,
  onItemUpdated,
  onItemDeleted,
  totals,
}: ShipmentTableProps) {
  const [editingPalet, setEditingPalet] = useState<string | null>(null);
  const [editingGrup, setEditingGrup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<SevkiyatItemRow | null>(null);

  const handlePaletEdit = (itemId: string, currentValue: number | null) => {
    setEditingPalet(itemId);
    setEditValue(String(currentValue ?? 0));
  };

  const handlePaletSave = async (itemId: string) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 1) {
      toast.error("Palet sayısı en az 1 olmalıdır");
      return;
    }
    setLoading(itemId);
    const result = await updateItemPaletSayisi(itemId, val);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Palet sayısı güncellendi");
      onItemUpdated();
    }
    setEditingPalet(null);
    setLoading(null);
  };

  const handleGrupEdit = (itemId: string, currentValue: string | null) => {
    setEditingGrup(itemId);
    setEditValue(currentValue ?? "");
  };

  const handleGrupSave = async (itemId: string) => {
    setLoading(itemId);
    const result = await updateItemGrup(itemId, editValue || null);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Grup güncellendi");
      onItemUpdated();
    }
    setEditingGrup(null);
    setLoading(null);
  };

  const handleDelete = async (itemId: string) => {
    setLoading(itemId);
    const result = await deleteSevkiyatItem(itemId);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Ürün silindi");
      onItemDeleted(itemId);
    }
    setLoading(null);
  };

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>Henüz ürün eklenmedi.</p>
        <p className="text-sm mt-1">Aşağıdaki &quot;Ürün Ekle&quot; butonunu kullanarak ürün ekleyebilirsiniz.</p>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-2 py-2 text-left font-semibold w-8">#</th>
                <th className="px-2 py-2 text-left font-semibold min-w-[100px]">Ürün</th>
                <th className="px-2 py-2 text-left font-semibold min-w-[70px]">Kodu</th>
                <th className="px-2 py-2 text-center font-semibold">Palet</th>
                <th className="px-2 py-2 text-center font-semibold">Yüks</th>
                <th className="px-2 py-2 text-center font-semibold">En</th>
                <th className="px-2 py-2 text-center font-semibold">Boy</th>
                <th className="px-2 py-2 text-center font-semibold">Yük</th>
                <th className="px-2 py-2 text-center font-semibold">Adet/Koli</th>
                <th className="px-2 py-2 text-center font-semibold">Plt Koli</th>
                <th className="px-2 py-2 text-center font-semibold">T. Koli</th>
                <th className="px-2 py-2 text-center font-semibold">Hacim m³</th>
                <th className="px-2 py-2 text-center font-semibold">Koli Ağ</th>
                <th className="px-2 py-2 text-center font-semibold">Ağırlık</th>
                <th className="px-2 py-2 text-center font-semibold min-w-[60px]">Grup</th>
                <th className="px-2 py-2 text-center font-semibold min-w-[60px]">Plt</th>
                <th className="px-2 py-2 text-center font-semibold">Adet</th>
                {isEditable && <th className="px-1 py-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.item_id}
                  className={cn(
                    "border-b hover:bg-muted/30 transition-colors",
                    loading === item.item_id && "opacity-50"
                  )}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-medium truncate max-w-[120px]">
                    {item.urun_adi ?? item.sku}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{item.sku}</td>
                  <td className="px-2 py-1.5 text-center">{item.palet_boyut}</td>
                  <td className="px-2 py-1.5 text-center">{item.palet_yukseklik}</td>
                  <td className="px-2 py-1.5 text-center">{item.en}</td>
                  <td className="px-2 py-1.5 text-center">{item.boy}</td>
                  <td className="px-2 py-1.5 text-center">{item.yuk}</td>
                  <td className="px-2 py-1.5 text-center">{item.koli_adedi}</td>
                  <td className="px-2 py-1.5 text-center">{item.palette_koli}</td>
                  <td className="px-2 py-1.5 text-center font-semibold">{item.toplam_koli}</td>
                  <td className="px-2 py-1.5 text-center">
                    {item.hacim != null ? item.hacim.toFixed(1) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">{item.koli_agirlik}</td>
                  <td className="px-2 py-1.5 text-center font-semibold">
                    {item.agirlik != null ? Math.round(item.agirlik).toLocaleString("tr-TR") : "—"}
                  </td>

                  {/* Grup — editable */}
                  <td className="px-1 py-1 text-center">
                    {isEditable && editingGrup === item.item_id ? (
                      <div className="flex items-center gap-0.5">
                        <Input
                          className="h-6 w-16 text-xs px-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGrupSave(item.item_id);
                            if (e.key === "Escape") setEditingGrup(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleGrupSave(item.item_id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "cursor-pointer hover:bg-muted rounded px-1",
                          isEditable && "border border-dashed border-transparent hover:border-muted-foreground/30"
                        )}
                        onClick={() => isEditable && handleGrupEdit(item.item_id, item.grup)}
                      >
                        {item.grup || "—"}
                      </span>
                    )}
                  </td>

                  {/* Palet Sayısı — editable */}
                  <td className="px-1 py-1 text-center">
                    {isEditable && editingPalet === item.item_id ? (
                      <div className="flex items-center gap-0.5">
                        <Input
                          type="number"
                          min={1}
                          className="h-6 w-14 text-xs px-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePaletSave(item.item_id);
                            if (e.key === "Escape") setEditingPalet(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handlePaletSave(item.item_id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold tabular-nums cursor-pointer hover:bg-muted rounded px-1",
                          isEditable && "border border-dashed border-transparent hover:border-muted-foreground/30"
                        )}
                        onClick={() => isEditable && handlePaletEdit(item.item_id, item.palet_sayisi)}
                      >
                        {item.palet_sayisi ?? 0}
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-1.5 text-center font-semibold tabular-nums">
                    {item.qty?.toLocaleString("tr-TR")}
                  </td>

                  {isEditable && (
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Kalemi düzenle"
                          onClick={() => setEditItem(item)}
                          disabled={loading === item.item_id}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          title="Kalemi sil"
                          onClick={() => handleDelete(item.item_id)}
                          disabled={loading === item.item_id}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {/* Toplam satırı */}
              <tr className="bg-muted/50 font-semibold">
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2">TOPLAM</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-center">{totals.koli.toLocaleString("tr-TR")}</td>
                <td className="px-2 py-2 text-center">{totals.hacim.toFixed(1)}</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-center">
                  {Math.round(totals.agirlik).toLocaleString("tr-TR")}
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-center">{totals.palet}</td>
                <td className="px-2 py-2 text-center">
                  {totals.adet.toLocaleString("tr-TR")}
                </td>
                {isEditable && <td className="px-1 py-2" />}
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <EditItemSheet
        item={editItem}
        siblings={items}
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        onSaved={onItemUpdated}
      />

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {items.map((item, idx) => (
          <Card
            key={item.item_id}
            className={cn("p-3", loading === item.item_id && "opacity-50")}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs text-muted-foreground mr-2">#{idx + 1}</span>
                <span className="font-medium text-sm">{item.urun_adi ?? item.sku}</span>
              </div>
              {isEditable && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Kalemi düzenle"
                    onClick={() => setEditItem(item)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    aria-label="Kalemi sil"
                    onClick={() => handleDelete(item.item_id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">SKU:</span>{" "}
                <span className="font-mono">{item.sku}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Palet:</span>{" "}
                {isEditable ? (
                  <span
                    className="font-semibold cursor-pointer underline decoration-dashed"
                    onClick={() => handlePaletEdit(item.item_id, item.palet_sayisi)}
                  >
                    {item.palet_sayisi}
                  </span>
                ) : (
                  <span className="font-semibold">{item.palet_sayisi}</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Grup:</span>{" "}
                {isEditable ? (
                  <span
                    className="cursor-pointer underline decoration-dashed"
                    onClick={() => handleGrupEdit(item.item_id, item.grup)}
                  >
                    {item.grup || "—"}
                  </span>
                ) : (
                  <span>{item.grup || "—"}</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Koli:</span>{" "}
                <span className="font-semibold">{item.toplam_koli}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Adet:</span>{" "}
                <span className="font-semibold">{item.qty?.toLocaleString("tr-TR")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ağırlık:</span>{" "}
                <span className="font-semibold">
                  {item.agirlik ? Math.round(item.agirlik).toLocaleString("tr-TR") : "—"} kg
                </span>
              </div>
            </div>

            {/* Mobile inline edit dialog */}
            {editingPalet === item.item_id && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded">
                <span className="text-xs">Palet:</span>
                <Input
                  type="number"
                  min={1}
                  className="h-7 w-20 text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => handlePaletSave(item.item_id)}>
                  Kaydet
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPalet(null)}>
                  İptal
                </Button>
              </div>
            )}
            {editingGrup === item.item_id && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded">
                <span className="text-xs">Grup:</span>
                <Input
                  className="h-7 w-20 text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => handleGrupSave(item.item_id)}>
                  Kaydet
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingGrup(null)}>
                  İptal
                </Button>
              </div>
            )}
          </Card>
        ))}

        {/* Mobile Toplam */}
        <Card className="p-3 bg-muted/50">
          <p className="text-xs font-semibold mb-1">TOPLAM</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>Palet: <span className="font-semibold">{totals.palet}</span></div>
            <div>Koli: <span className="font-semibold">{totals.koli.toLocaleString("tr-TR")}</span></div>
            <div>Adet: <span className="font-semibold">{totals.adet.toLocaleString("tr-TR")}</span></div>
            <div>Ağırlık: <span className="font-semibold">{Math.round(totals.agirlik).toLocaleString("tr-TR")} kg</span></div>
            <div>Hacim: <span className="font-semibold">{totals.hacim.toFixed(1)} m³</span></div>
          </div>
        </Card>
      </div>
    </>
  );
}
