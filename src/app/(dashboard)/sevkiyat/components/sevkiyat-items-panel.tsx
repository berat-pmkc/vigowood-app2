"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSevkiyatItems,
  getActiveProducts,
  addSevkiyatItem,
  deleteSevkiyatItem,
  type SevkiyatItemRow,
} from "../actions";
import { Plus, Trash2, Check, ChevronsUpDown, Package, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PALET_BOYUTLARI, SEVKIYAT_COUNTRIES, type SevkiyatCountryCode } from "@/lib/constants";

interface SevkiyatItemsPanelProps {
  sevkiyatId: string;
  countryCode: string | null;
  readonly?: boolean;
}

interface ProductOption {
  sku: string;
  urun_adi: string | null;
  stok_aktif: number;
}

export function SevkiyatItemsPanel({ sevkiyatId, countryCode, readonly }: SevkiyatItemsPanelProps) {
  const [items, setItems] = useState<SevkiyatItemRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addFormOpen, setAddFormOpen] = useState(false);

  // Add form state
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [paletBoyut, setPaletBoyut] = useState<string>("80x120");
  const [paletYukseklik, setPaletYukseklik] = useState<number>(100);
  const [en, setEn] = useState<number>(0);
  const [boy, setBoy] = useState<number>(0);
  const [yuk, setYuk] = useState<number>(0);
  const [koliAdedi, setKoliAdedi] = useState<number>(1);
  const [paletteKoli, setPaletteKoli] = useState<number>(1);
  const [koliAgirlik, setKoliAgirlik] = useState<number>(1);
  const [paletSayisi, setPaletSayisi] = useState<number>(1);
  const [grup, setGrup] = useState<string>("");

  const country = countryCode ? SEVKIYAT_COUNTRIES[countryCode as SevkiyatCountryCode] : null;
  const currencySymbol = country?.currencySymbol ?? "$";

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, productsRes] = await Promise.all([
      getSevkiyatItems(sevkiyatId),
      readonly ? Promise.resolve({ success: true as const, data: [] as ProductOption[] }) : getActiveProducts(),
    ]);

    if (itemsRes.success) setItems(itemsRes.data);
    if (productsRes.success) setProducts(productsRes.data as ProductOption[]);
    setLoading(false);
  }, [sevkiyatId, readonly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!selectedSku) return;
    setAddLoading(true);
    const result = await addSevkiyatItem(sevkiyatId, {
      sku: selectedSku,
      palet_boyut: paletBoyut,
      palet_yukseklik: paletYukseklik,
      en,
      boy,
      yuk,
      koli_adedi: koliAdedi,
      palette_koli: paletteKoli,
      koli_agirlik: koliAgirlik,
      palet_sayisi: paletSayisi,
      grup: grup || null,
    });
    if (result.success) {
      toast.success("\u00dcr\u00fcn eklendi");
      setSelectedSku("");
      setAddFormOpen(false);
      loadData();
    } else {
      toast.error(result.error);
    }
    setAddLoading(false);
  };

  const handleDelete = async (itemId: string) => {
    const result = await deleteSevkiyatItem(itemId);
    if (result.success) {
      toast.success("\u00dcr\u00fcn kald\u0131r\u0131ld\u0131");
      loadData();
    } else {
      toast.error(result.error);
    }
  };

  // Toplamlar
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const totalPalet = items.reduce((sum, i) => sum + (i.palet_sayisi ?? 0), 0);
  const totalKoli = items.reduce((sum, i) => sum + (i.toplam_koli ?? 0), 0);
  const totalAgirlik = items.reduce((sum, i) => sum + (i.agirlik ?? 0), 0);
  const totalHacim = items.reduce((sum, i) => sum + (i.hacim ?? 0), 0);
  const totalFiyat = items.reduce((sum, i) => sum + (i.toplam_fiyat ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Y\u00fckleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          \u00dcr\u00fcnler ({items.length} kalem)
        </h4>
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Hen\u00fcz \u00fcr\u00fcn eklenmemi\u015f
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-2">\u00dcr\u00fcn</th>
                <th className="text-right py-2 px-1">Plt</th>
                <th className="text-right py-2 px-1">Koli</th>
                <th className="text-right py-2 px-1">Adet</th>
                <th className="text-right py-2 px-1 hidden sm:table-cell">kg</th>
                <th className="text-right py-2 px-1 hidden sm:table-cell">m\u00b3</th>
                <th className="text-right py-2 px-1">Tutar</th>
                {!readonly && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <p className="font-medium truncate max-w-[140px]">{item.urun_adi ?? item.sku}</p>
                    <p className="text-muted-foreground">{item.sku}</p>
                  </td>
                  <td className="text-right py-2 px-1 tabular-nums">{item.palet_sayisi ?? "-"}</td>
                  <td className="text-right py-2 px-1 tabular-nums">{item.toplam_koli ?? "-"}</td>
                  <td className="text-right py-2 px-1 tabular-nums font-semibold">{item.qty}</td>
                  <td className="text-right py-2 px-1 tabular-nums hidden sm:table-cell">
                    {item.agirlik ? Math.round(item.agirlik) : "-"}
                  </td>
                  <td className="text-right py-2 px-1 tabular-nums hidden sm:table-cell">
                    {item.hacim ? item.hacim.toFixed(2) : "-"}
                  </td>
                  <td className="text-right py-2 px-1 tabular-nums font-semibold">
                    {item.toplam_fiyat ? `${currencySymbol}${item.toplam_fiyat.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "-"}
                  </td>
                  {!readonly && (
                    <td className="py-2 pl-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.item_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 font-semibold text-xs">
                  <td className="py-2 pr-2">TOPLAM</td>
                  <td className="text-right py-2 px-1 tabular-nums">{totalPalet}</td>
                  <td className="text-right py-2 px-1 tabular-nums">{totalKoli}</td>
                  <td className="text-right py-2 px-1 tabular-nums">{totalQty}</td>
                  <td className="text-right py-2 px-1 tabular-nums hidden sm:table-cell">{Math.round(totalAgirlik)}</td>
                  <td className="text-right py-2 px-1 tabular-nums hidden sm:table-cell">{totalHacim.toFixed(2)}</td>
                  <td className="text-right py-2 px-1 tabular-nums">
                    {currencySymbol}{totalFiyat.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  {!readonly && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Add item form */}
      {!readonly && (
        <div className="rounded-md border border-dashed p-3 space-y-3">
          <button
            type="button"
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setAddFormOpen(!addFormOpen)}
          >
            <span className="flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              \u00dcr\u00fcn Ekle
            </span>
            {addFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {addFormOpen && (
            <div className="space-y-3 pt-2">
              {/* SKU */}
              <div>
                <Label className="text-xs">\u00dcr\u00fcn *</Label>
                <Popover open={addOpen} onOpenChange={setAddOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={addOpen}
                      className="w-full justify-between h-9 text-sm mt-1"
                    >
                      {selectedSku
                        ? products.find((p) => p.sku === selectedSku)?.urun_adi ?? selectedSku
                        : "\u00dcr\u00fcn se\u00e7in..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="\u00dcr\u00fcn ara..." />
                      <CommandList>
                        <CommandEmpty>\u00dcr\u00fcn bulunamad\u0131</CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem
                              key={p.sku}
                              value={`${p.sku} ${p.urun_adi ?? ""}`}
                              onSelect={() => {
                                setSelectedSku(p.sku);
                                setAddOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedSku === p.sku ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="truncate">{p.urun_adi ?? p.sku}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  stok: {p.stok_aktif ?? 0}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Palet & Koli bilgileri */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Palet Boyut</Label>
                  <Select value={paletBoyut} onValueChange={setPaletBoyut}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PALET_BOYUTLARI.map((b) => (
                        <SelectItem key={b} value={b}>{b} cm</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Palet Y\u00fckseklik (cm)</Label>
                  <Input type="number" value={paletYukseklik} onChange={(e) => setPaletYukseklik(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">En (cm)</Label>
                  <Input type="number" value={en || ""} onChange={(e) => setEn(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
                <div>
                  <Label className="text-xs">Boy (cm)</Label>
                  <Input type="number" value={boy || ""} onChange={(e) => setBoy(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
                <div>
                  <Label className="text-xs">Y\u00fck (cm)</Label>
                  <Input type="number" value={yuk || ""} onChange={(e) => setYuk(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Koli Adedi</Label>
                  <Input type="number" value={koliAdedi} onChange={(e) => setKoliAdedi(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
                <div>
                  <Label className="text-xs">Palette Koli</Label>
                  <Input type="number" value={paletteKoli} onChange={(e) => setPaletteKoli(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
                <div>
                  <Label className="text-xs">Koli A\u011f\u0131rl\u0131k (kg)</Label>
                  <Input type="number" step="0.1" value={koliAgirlik} onChange={(e) => setKoliAgirlik(Number(e.target.value))} className="h-8 text-xs mt-1" min={0.1} />
                </div>
                <div>
                  <Label className="text-xs">Palet Say\u0131s\u0131</Label>
                  <Input type="number" value={paletSayisi} onChange={(e) => setPaletSayisi(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Grup</Label>
                <Input value={grup} onChange={(e) => setGrup(e.target.value)} className="h-8 text-xs mt-1" placeholder="Opsiyonel" />
              </div>

              {/* Auto-calculated preview */}
              {selectedSku && koliAdedi > 0 && paletteKoli > 0 && paletSayisi > 0 && (
                <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                  <p className="font-medium text-muted-foreground">Hesaplanan De\u011ferler:</p>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                    <span>Toplam Koli: <strong>{paletteKoli * paletSayisi}</strong></span>
                    <span>Adet: <strong>{koliAdedi * paletteKoli * paletSayisi}</strong></span>
                    <span>A\u011f\u0131rl\u0131k: <strong>{(koliAgirlik * paletteKoli * paletSayisi).toFixed(1)} kg</strong></span>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                className="w-full h-9"
                onClick={handleAdd}
                disabled={!selectedSku || addLoading}
              >
                <Plus className="w-4 h-4 mr-1" />
                {addLoading ? "Ekleniyor..." : "\u00dcr\u00fcn Ekle"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
