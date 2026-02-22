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
  getPaletSablonlar,
  addSevkiyatItem,
  deleteSevkiyatItem,
  type SevkiyatItemRow,
} from "../actions";
import { Plus, Trash2, Check, ChevronsUpDown, Package, ChevronDown, ChevronUp, Pencil, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SevkiyatItemsPanelProps {
  sevkiyatId: string;
  countryCode: string | null;
  readonly?: boolean;
  paletBoyutlari?: string[];
}

interface ProductOption {
  sku: string;
  urun_adi: string | null;
  stok_aktif: number;
}

interface SablonData {
  palet_boyut: string;
  palet_yukseklik: number;
  en: number;
  boy: number;
  yuk: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
}

const DEFAULT_PALET_BOYUTLARI = ["80x120", "100x120", "114x114", "80x60"];

export function SevkiyatItemsPanel({ sevkiyatId, countryCode, readonly, paletBoyutlari }: SevkiyatItemsPanelProps) {
  const boyutlar = paletBoyutlari ?? DEFAULT_PALET_BOYUTLARI;
  const [items, setItems] = useState<SevkiyatItemRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addFormOpen, setAddFormOpen] = useState(false);

  // Add form state
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [sablonLoading, setSablonLoading] = useState(false);
  const [sablon, setSablon] = useState<SablonData | null>(null);
  const [overrideMode, setOverrideMode] = useState(false);

  // Form values (from sablon or manual)
  const [paletBoyut, setPaletBoyut] = useState<string>("80x120");
  const [paletYukseklik, setPaletYukseklik] = useState<number>(125);
  const [en, setEn] = useState<number>(0);
  const [boy, setBoy] = useState<number>(0);
  const [yuk, setYuk] = useState<number>(0);
  const [koliAdedi, setKoliAdedi] = useState<number>(1);
  const [paletteKoli, setPaletteKoli] = useState<number>(1);
  const [koliAgirlik, setKoliAgirlik] = useState<number>(1);
  const [paletSayisi, setPaletSayisi] = useState<number>(1);
  const [grup, setGrup] = useState<string>("");

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

  // SKU seçildiğinde şablonu yükle
  const handleSkuSelect = useCallback(async (sku: string) => {
    setSelectedSku(sku);
    setAddOpen(false);
    setOverrideMode(false);
    setSablon(null);

    if (!sku) return;

    setSablonLoading(true);
    const result = await getPaletSablonlar(sku);
    setSablonLoading(false);

    if (result.success && result.data && result.data.length > 0) {
      const s = result.data[0];
      setSablon(s);
      setPaletBoyut(s.palet_boyut);
      setPaletYukseklik(s.palet_yukseklik);
      setEn(s.en);
      setBoy(s.boy);
      setYuk(s.yuk);
      setKoliAdedi(s.koli_adedi);
      setPaletteKoli(s.palette_koli);
      setKoliAgirlik(s.koli_agirlik);
      setPaletSayisi(1);
    } else {
      // Şablon yok — varsayılan değerler
      setPaletBoyut("80x120");
      setPaletYukseklik(125);
      setEn(0);
      setBoy(0);
      setYuk(0);
      setKoliAdedi(1);
      setPaletteKoli(1);
      setKoliAgirlik(1);
      setPaletSayisi(1);
    }
  }, []);

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
      toast.success("Ürün eklendi");
      setSelectedSku("");
      setSablon(null);
      setGrup("");
      setPaletSayisi(1);
      setOverrideMode(false);
      loadData();
    } else {
      toast.error(result.error);
    }
    setAddLoading(false);
  };

  const handleDelete = async (itemId: string) => {
    const result = await deleteSevkiyatItem(itemId);
    if (result.success) {
      toast.success("Ürün kaldırıldı");
      loadData();
    } else {
      toast.error(result.error);
    }
  };

  // Hesaplamalar
  const toplamKoli = paletteKoli * paletSayisi;
  const toplamAdet = koliAdedi * toplamKoli;
  const toplamAgirlik = koliAgirlik * toplamKoli;

  // Toplamlar
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const totalPalet = items.reduce((sum, i) => sum + (i.palet_sayisi ?? 0), 0);
  const totalKoli = items.reduce((sum, i) => sum + (i.toplam_koli ?? 0), 0);
  const totalAgirlik = items.reduce((sum, i) => sum + (i.agirlik ?? 0), 0);
  const totalHacim = items.reduce((sum, i) => sum + (i.hacim ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          Ürünler ({items.length} kalem)
        </h4>
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Henüz ürün eklenmemiş
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-2">Ürün</th>
                <th className="text-right py-2 px-1">Plt</th>
                <th className="text-right py-2 px-1">Koli</th>
                <th className="text-right py-2 px-1">Adet</th>
                <th className="text-right py-2 px-1 hidden sm:table-cell">kg</th>
                <th className="text-right py-2 px-1 hidden sm:table-cell">m³</th>
                {!readonly && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <p className="font-medium truncate max-w-[140px]">{item.urun_adi ?? item.sku}</p>
                    <p className="text-muted-foreground">{item.sku}{item.grup ? ` · ${item.grup}` : ""}</p>
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
              Ürün Ekle
            </span>
            {addFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {addFormOpen && (
            <div className="space-y-3 pt-2">
              {/* SKU */}
              <div>
                <Label className="text-xs">Ürün *</Label>
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
                        : "Ürün seçin..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Ürün ara..." />
                      <CommandList>
                        <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem
                              key={p.sku}
                              value={`${p.sku} ${p.urun_adi ?? ""}`}
                              onSelect={() => handleSkuSelect(p.sku)}
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

              {/* Şablon yükleniyor */}
              {sablonLoading && (
                <p className="text-xs text-muted-foreground">Şablon yükleniyor...</p>
              )}

              {/* Şablon bulundu — readonly bilgi + Düzenle toggle */}
              {selectedSku && !sablonLoading && sablon && !overrideMode && (
                <div className="rounded border bg-muted/30 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Şablon Bilgileri
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => setOverrideMode(true)}
                    >
                      <Pencil className="w-3 h-3" />
                      Düzenle
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                    <span>Palet: <strong>{sablon.palet_boyut}</strong></span>
                    <span>Yüks: <strong>{sablon.palet_yukseklik}cm</strong></span>
                    <span>Koli: <strong>{sablon.en}×{sablon.boy}×{sablon.yuk}cm</strong></span>
                    <span>kg/Koli: <strong>{sablon.koli_agirlik}</strong></span>
                    <span>Koli/Plt: <strong>{sablon.palette_koli}</strong></span>
                    <span>Adet/Koli: <strong>{sablon.koli_adedi}</strong></span>
                  </div>
                </div>
              )}

              {/* Şablon yok veya override modu — tam form */}
              {selectedSku && !sablonLoading && (!sablon || overrideMode) && (
                <>
                  {!sablon && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Bu ürün için şablon bulunamadı, değerleri elle girin.
                    </p>
                  )}

                  {overrideMode && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Şablon değerleri düzenleniyor</p>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          // Şablona geri dön
                          if (sablon) {
                            setPaletBoyut(sablon.palet_boyut);
                            setPaletYukseklik(sablon.palet_yukseklik);
                            setEn(sablon.en);
                            setBoy(sablon.boy);
                            setYuk(sablon.yuk);
                            setKoliAdedi(sablon.koli_adedi);
                            setPaletteKoli(sablon.palette_koli);
                            setKoliAgirlik(sablon.koli_agirlik);
                          }
                          setOverrideMode(false);
                        }}
                      >
                        Şablona Dön
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Palet Boyut</Label>
                      <Select value={paletBoyut} onValueChange={setPaletBoyut}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {boyutlar.map((b) => (
                            <SelectItem key={b} value={b}>{b} cm</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Palet Yükseklik (cm)</Label>
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
                      <Label className="text-xs">Yük (cm)</Label>
                      <Input type="number" value={yuk || ""} onChange={(e) => setYuk(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Adet/Koli</Label>
                      <Input type="number" value={koliAdedi} onChange={(e) => setKoliAdedi(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                    </div>
                    <div>
                      <Label className="text-xs">Koli/Palet</Label>
                      <Input type="number" value={paletteKoli} onChange={(e) => setPaletteKoli(Number(e.target.value))} className="h-8 text-xs mt-1" min={1} />
                    </div>
                    <div>
                      <Label className="text-xs">kg/Koli</Label>
                      <Input type="number" step="0.1" value={koliAgirlik} onChange={(e) => setKoliAgirlik(Number(e.target.value))} className="h-8 text-xs mt-1" min={0.1} />
                    </div>
                  </div>
                </>
              )}

              {/* Grup + Palet Sayısı — her zaman görünür (sku seçildikten sonra) */}
              {selectedSku && !sablonLoading && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Grup</Label>
                      <Input value={grup} onChange={(e) => setGrup(e.target.value)} className="h-8 text-xs mt-1" placeholder="Opsiyonel (DTM1, LEJ3...)" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Palet Adedi *</Label>
                      <Input
                        type="number"
                        value={paletSayisi}
                        onChange={(e) => setPaletSayisi(Number(e.target.value))}
                        className="h-8 text-xs mt-1 border-primary/50 font-semibold"
                        min={1}
                      />
                    </div>
                  </div>

                  {/* Auto-calculated preview */}
                  {koliAdedi > 0 && paletteKoli > 0 && paletSayisi > 0 && (
                    <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                      <p className="font-medium text-muted-foreground">Hesaplanan Değerler:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                        <span>Toplam Koli: <strong>{toplamKoli}</strong></span>
                        <span>Adet: <strong>{toplamAdet}</strong></span>
                        <span>Ağırlık: <strong>{toplamAgirlik.toFixed(1)} kg</strong></span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button
                size="sm"
                className="w-full h-9"
                onClick={handleAdd}
                disabled={!selectedSku || addLoading}
              >
                <Plus className="w-4 h-4 mr-1" />
                {addLoading ? "Ekleniyor..." : "Ürün Ekle"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
