"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import { addSevkiyatItem, getPaletSablon } from "../../actions";
import { Plus, ChevronsUpDown, Check, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddItemRowProps {
  sevkiyatId: string;
  countryCode: string;
  products: {
    sku: string;
    urun_adi: string | null;
    kategori: string | null;
    stok_aktif: number;
  }[];
  onItemAdded: () => void;
}

export function AddItemRow({
  sevkiyatId,
  countryCode,
  products,
  onItemAdded,
}: AddItemRowProps) {
  const [open, setOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [sablonLoading, setSablonLoading] = useState(false);
  const [hasSablon, setHasSablon] = useState(false);

  // Form values
  const [paletBoyut, setPaletBoyut] = useState("80x120");
  const [paletYukseklik, setPaletYukseklik] = useState(0);
  const [en, setEn] = useState(0);
  const [boy, setBoy] = useState(0);
  const [yuk, setYuk] = useState(0);
  const [koliAdedi, setKoliAdedi] = useState(0);
  const [paletteKoli, setPaletteKoli] = useState(0);
  const [koliAgirlik, setKoliAgirlik] = useState(0);
  const [paletSayisi, setPaletSayisi] = useState(1);
  const [grup, setGrup] = useState("");

  const resetForm = () => {
    setSelectedSku("");
    setPaletBoyut("80x120");
    setPaletYukseklik(0);
    setEn(0);
    setBoy(0);
    setYuk(0);
    setKoliAdedi(0);
    setPaletteKoli(0);
    setKoliAgirlik(0);
    setPaletSayisi(1);
    setGrup("");
    setHasSablon(false);
  };

  const handleSkuSelect = async (sku: string) => {
    setSelectedSku(sku);
    setSkuOpen(false);
    setSablonLoading(true);

    const result = await getPaletSablon(countryCode, sku);
    if (result.success && result.data) {
      const s = result.data;
      setPaletBoyut(s.palet_boyut);
      setPaletYukseklik(s.palet_yukseklik);
      setEn(s.en);
      setBoy(s.boy);
      setYuk(s.yuk);
      setKoliAdedi(s.koli_adedi);
      setPaletteKoli(s.palette_koli);
      setKoliAgirlik(s.koli_agirlik);
      setHasSablon(true);
    } else {
      setHasSablon(false);
    }
    setSablonLoading(false);
  };

  const handleAdd = async () => {
    if (!selectedSku) {
      toast.error("Ürün seçiniz");
      return;
    }
    if (paletSayisi < 1) {
      toast.error("Palet sayısı en az 1 olmalıdır");
      return;
    }
    if (!hasSablon && (paletYukseklik < 1 || koliAdedi < 1 || paletteKoli < 1)) {
      toast.error("Şablon bulunamadı. Lütfen tüm alanları doldurun.");
      return;
    }

    setLoading(true);
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

    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Ürün eklendi");
      resetForm();
      setOpen(false);
      onItemAdded();
    }
    setLoading(false);
  };

  // Hesaplanan değerler
  const toplamKoli = paletteKoli * paletSayisi;
  const adet = koliAdedi * toplamKoli;
  const agirlik = koliAgirlik * toplamKoli;

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  if (!open) {
    return (
      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Ürün Ekle
      </Button>
    );
  }

  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Yeni Ürün Ekle</h3>
          <Button variant="ghost" size="sm" onClick={() => { resetForm(); setOpen(false); }}>
            İptal
          </Button>
        </div>

        {/* SKU Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Ürün (SKU)</Label>
            <Popover open={skuOpen} onOpenChange={setSkuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-9 text-xs"
                >
                  {selectedSku
                    ? selectedSku
                    : "Ürün seçiniz..."}
                  <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="SKU veya ürün adı ara..." className="text-xs" />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.sku}
                          value={`${p.sku} ${p.urun_adi ?? ""}`}
                          onSelect={() => handleSkuSelect(p.sku)}
                          className="text-xs"
                        >
                          <Check
                            className={cn(
                              "mr-1 h-3 w-3",
                              selectedSku === p.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono mr-2">{p.sku}</span>
                          <span className="truncate flex-1 text-muted-foreground">{p.urun_adi}</span>
                          <span className="text-muted-foreground ml-1">({p.stok_aktif})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs">Palet Sayısı</Label>
            <Input
              type="number"
              min={1}
              className="h-9 text-xs"
              value={paletSayisi || ""}
              onChange={(e) => setPaletSayisi(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        {/* Şablon yükleniyor */}
        {sablonLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Şablon yükleniyor...
          </div>
        )}

        {/* Şablon bulundu */}
        {selectedSku && !sablonLoading && hasSablon && (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs">
            <p className="font-medium text-emerald-700 mb-2">Şablon yüklendi</p>
            <div className="grid grid-cols-4 gap-2 text-emerald-700">
              <div>Palet: <span className="font-semibold">{paletBoyut}</span></div>
              <div>Yüks: <span className="font-semibold">{paletYukseklik}</span></div>
              <div>Koli/Adet: <span className="font-semibold">{koliAdedi}</span></div>
              <div>Plt Koli: <span className="font-semibold">{paletteKoli}</span></div>
              <div>En: <span className="font-semibold">{en}</span></div>
              <div>Boy: <span className="font-semibold">{boy}</span></div>
              <div>Yük: <span className="font-semibold">{yuk}</span></div>
              <div>Koli Ağ: <span className="font-semibold">{koliAgirlik}</span></div>
            </div>
          </div>
        )}

        {/* Şablon bulunamadı — full form */}
        {selectedSku && !sablonLoading && !hasSablon && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              Şablon bulunamadı. Lütfen değerleri girin.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Palet Boyut</Label>
                <Input className="h-8 text-xs" value={paletBoyut} onChange={(e) => setPaletBoyut(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Palet Yükseklik</Label>
                <Input type="number" className="h-8 text-xs" value={paletYukseklik || ""} onChange={(e) => setPaletYukseklik(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">En (cm)</Label>
                <Input type="number" className="h-8 text-xs" value={en || ""} onChange={(e) => setEn(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Boy (cm)</Label>
                <Input type="number" className="h-8 text-xs" value={boy || ""} onChange={(e) => setBoy(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Yükseklik (cm)</Label>
                <Input type="number" className="h-8 text-xs" value={yuk || ""} onChange={(e) => setYuk(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Adet/Koli</Label>
                <Input type="number" className="h-8 text-xs" value={koliAdedi || ""} onChange={(e) => setKoliAdedi(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Palette Koli</Label>
                <Input type="number" className="h-8 text-xs" value={paletteKoli || ""} onChange={(e) => setPaletteKoli(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Koli Ağırlık (kg)</Label>
                <Input type="number" step="0.1" className="h-8 text-xs" value={koliAgirlik || ""} onChange={(e) => setKoliAgirlik(Number(e.target.value))} />
              </div>
            </div>
          </div>
        )}

        {/* Grup */}
        {selectedSku && !sablonLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs">Grup (Opsiyonel)</Label>
              <Input
                className="h-9 text-xs"
                placeholder="DTM1, DTM2..."
                value={grup}
                onChange={(e) => setGrup(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>T. Koli: <span className="font-semibold">{toplamKoli}</span></p>
              <p>Adet: <span className="font-semibold">{adet.toLocaleString("tr-TR")}</span></p>
              <p>Ağırlık: <span className="font-semibold">{Math.round(agirlik).toLocaleString("tr-TR")} kg</span></p>
            </div>
            <Button
              onClick={handleAdd}
              disabled={loading || !selectedSku}
              className="h-9"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Ekle
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
