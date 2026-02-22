"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { sevkiyatCreateSchema, type SevkiyatCreateData } from "@/lib/validations";
import type { ShipmentCountry, KonteynerTipi, AracTipi } from "@/lib/shipment-settings-types";
import { createSevkiyatWithItems, getPaletSablonlar } from "../actions";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Building2,
  Banknote,
  Plus,
  Trash2,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  Loader2,
  Package,
  Container,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LocalItem {
  id: string;
  sku: string;
  urun_adi: string;
  palet_boyut: string;
  palet_yukseklik: number;
  en: number;
  boy: number;
  yuk: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
  palet_sayisi: number;
  grup: string | null;
  hasSablon: boolean;
}

interface YeniSevkiyatFormProps {
  products: {
    sku: string;
    urun_adi: string | null;
    kategori: string | null;
    stok_aktif: number;
  }[];
  ulkeler: ShipmentCountry[];
  konteynerTipleri: KonteynerTipi[];
  aracTipleri: AracTipi[];
}

export function YeniSevkiyatForm({ products, ulkeler, konteynerTipleri, aracTipleri }: YeniSevkiyatFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LocalItem[]>([]);

  // Item ekleme state
  const [skuOpen, setSkuOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [sablonLoading, setSablonLoading] = useState(false);
  const [hasSablon, setHasSablon] = useState(false);
  const [itemForm, setItemForm] = useState({
    palet_boyut: "80x120",
    palet_yukseklik: 0,
    en: 0, boy: 0, yuk: 0,
    koli_adedi: 0,
    palette_koli: 0,
    koli_agirlik: 0,
    palet_sayisi: 1,
    grup: "",
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SevkiyatCreateData>({
    resolver: zodResolver(sevkiyatCreateSchema),
    defaultValues: {
      country_code: "DE",
      arac_tipi: "konteyner",
      planlanan_sevk_tarihi: null,
      konteyner_no: null,
      konteyner_tipi: null,
      tir_plaka: null,
      not_text: null,
    },
  });

  const countryCode = watch("country_code");
  const aracTipi = watch("arac_tipi") ?? "konteyner";
  const selectedCountry = countryCode ? ulkeler.find((c) => c.code === countryCode) ?? null : null;

  const resetItemForm = () => {
    setSelectedSku("");
    setHasSablon(false);
    setItemForm({
      palet_boyut: "80x120", palet_yukseklik: 0,
      en: 0, boy: 0, yuk: 0,
      koli_adedi: 0, palette_koli: 0, koli_agirlik: 0,
      palet_sayisi: 1, grup: "",
    });
  };

  const handleSkuSelect = useCallback(async (sku: string) => {
    setSelectedSku(sku);
    setSkuOpen(false);
    setSablonLoading(true);

    const result = await getPaletSablonlar(sku);
    if (result.success && result.data && result.data.length > 0) {
      const s = result.data[0];
      setItemForm({
        palet_boyut: s.palet_boyut,
        palet_yukseklik: s.palet_yukseklik,
        en: s.en, boy: s.boy, yuk: s.yuk,
        koli_adedi: s.koli_adedi,
        palette_koli: s.palette_koli,
        koli_agirlik: s.koli_agirlik,
        palet_sayisi: 1,
        grup: "",
      });
      setHasSablon(true);
    } else {
      setHasSablon(false);
    }
    setSablonLoading(false);
  }, []);

  const handleAddItem = () => {
    if (!selectedSku) return toast.error("Ürün seçiniz");
    if (itemForm.palet_sayisi < 1) return toast.error("Palet sayısı en az 1 olmalıdır");
    if (!hasSablon && (itemForm.palet_yukseklik < 1 || itemForm.koli_adedi < 1 || itemForm.palette_koli < 1)) {
      return toast.error("Şablon bulunamadı. Lütfen tüm alanları doldurun.");
    }

    const product = products.find((p) => p.sku === selectedSku);
    setItems((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        sku: selectedSku,
        urun_adi: product?.urun_adi ?? selectedSku,
        ...itemForm,
        grup: itemForm.grup || null,
        hasSablon,
      },
    ]);
    resetItemForm();
    toast.success("Ürün listeye eklendi");
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const onSubmit = async (data: SevkiyatCreateData) => {
    setLoading(true);

    const result = await createSevkiyatWithItems(
      {
        country_code: data.country_code,
        arac_tipi: data.arac_tipi,
        konteyner_no: data.konteyner_no || null,
        konteyner_tipi: data.konteyner_tipi || null,
        tir_plaka: data.tir_plaka || null,
        dorse_plaka: data.dorse_plaka || null,
        planlanan_sevk_tarihi: data.planlanan_sevk_tarihi || null,
        tasiyici_firma: data.tasiyici_firma || null,
        not_text: data.not_text || null,
      },
      items.map((item) => ({
        sku: item.sku,
        palet_boyut: item.palet_boyut,
        palet_yukseklik: item.palet_yukseklik,
        en: item.en,
        boy: item.boy,
        yuk: item.yuk,
        koli_adedi: item.koli_adedi,
        palette_koli: item.palette_koli,
        koli_agirlik: item.koli_agirlik,
        palet_sayisi: item.palet_sayisi,
        grup: item.grup,
      }))
    );

    if (result.success && result.sevkiyatId) {
      toast.success("Sevkiyat oluşturuldu");
      router.push(`/sevkiyat/${result.sevkiyatId}`);
    } else {
      toast.error(result.success ? "Sevkiyat oluşturulamadı" : result.error);
    }
    setLoading(false);
  };

  const selectedProduct = products.find((p) => p.sku === selectedSku);
  const toplamKoli = itemForm.palette_koli * itemForm.palet_sayisi;
  const adet = itemForm.koli_adedi * toplamKoli;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sevkiyat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Yeni Sevkiyat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ülke seçin, bilgileri girin ve ürünleri ekleyin
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* --- Sevkiyat Bilgileri --- */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sevkiyat Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ülke */}
              <div className="space-y-2">
                <Label>Ülke *</Label>
                <Select
                  value={countryCode ?? "DE"}
                  onValueChange={(v) => setValue("country_code", v as SevkiyatCreateData["country_code"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ülke seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ulkeler.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.currencySymbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country_code && (
                  <p className="text-sm text-destructive">{errors.country_code.message}</p>
                )}
              </div>

              {/* Planlanan Tarih */}
              <div className="space-y-2">
                <Label htmlFor="planlanan_sevk_tarihi">Planlanan Sevk Tarihi</Label>
                <Input
                  id="planlanan_sevk_tarihi"
                  type="date"
                  {...register("planlanan_sevk_tarihi", { setValueAs: (v: string) => v === "" ? null : v })}
                />
              </div>
            </div>

            {/* Otomatik bilgiler */}
            {selectedCountry && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    {selectedCountry.buyer}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    {selectedCountry.port}
                  </span>
                  <span className="flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-muted-foreground" />
                    {selectedCountry.currency}
                  </span>
                </div>
              </div>
            )}

            {/* Araç Tipi */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Araç Tipi</Label>
                <Select
                  value={aracTipi}
                  onValueChange={(v) => setValue("arac_tipi", v as "konteyner" | "tir")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aracTipleri.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.id === "konteyner" ? <Container className="w-4 h-4 inline mr-1" /> : <Truck className="w-4 h-4 inline mr-1" />}
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {aracTipi === "konteyner" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="konteyner_no">Konteyner No</Label>
                    <Input
                      id="konteyner_no"
                      placeholder="ABCD1234567"
                      {...register("konteyner_no", { setValueAs: (v: string) => v === "" ? null : v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Konteyner Tipi</Label>
                    <Select
                      value={watch("konteyner_tipi") ?? ""}
                      onValueChange={(v) => setValue("konteyner_tipi", v === "" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {konteynerTipleri.map((k) => (
                          <SelectItem key={k.type} value={k.type}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tir_plaka">Tır Plaka</Label>
                    <Input
                      id="tir_plaka"
                      placeholder="34 ABC 123"
                      {...register("tir_plaka", { setValueAs: (v: string) => v === "" ? null : v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dorse_plaka">Dorse Plaka</Label>
                    <Input
                      id="dorse_plaka"
                      placeholder="34 DEF 456"
                      {...register("dorse_plaka", { setValueAs: (v: string) => v === "" ? null : v })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Taşıyıcı Firma */}
            <div className="space-y-2">
              <Label htmlFor="tasiyici_firma">Taşıyıcı Firma</Label>
              <Input
                id="tasiyici_firma"
                placeholder="Nakliye firma adı..."
                {...register("tasiyici_firma", { setValueAs: (v: string) => v === "" ? null : v })}
              />
            </div>

            {/* Not */}
            <div className="space-y-2">
              <Label htmlFor="not_text">Not</Label>
              <Textarea
                id="not_text"
                placeholder="Ek bilgi veya not..."
                rows={2}
                {...register("not_text", { setValueAs: (v: string) => v === "" ? null : v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* --- Ürünler --- */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Ürünler
              </span>
              {items.length > 0 && (
                <Badge variant="secondary">{items.length} ürün</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Eklenen ürünler listesi */}
            {items.map((item) => {
              const tKoli = item.palette_koli * item.palet_sayisi;
              const tAdet = item.koli_adedi * tKoli;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                      <span className="truncate font-medium">{item.urun_adi}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{item.palet_sayisi} plt</span>
                      <span>{tKoli} koli</span>
                      <span>{tAdet.toLocaleString("tr-TR")} adet</span>
                      {item.grup && <Badge variant="outline" className="text-[10px] h-4">{item.grup}</Badge>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}

            {/* Ürün ekleme formu */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Ürün Ekle</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Ürün (SKU)</Label>
                  <Popover open={skuOpen} onOpenChange={setSkuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
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
                    value={itemForm.palet_sayisi || ""}
                    onChange={(e) => setItemForm((f) => ({ ...f, palet_sayisi: parseInt(e.target.value, 10) || 0 }))}
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
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                  <p className="font-medium text-emerald-700 mb-1">Şablon yüklendi</p>
                  <div className="grid grid-cols-4 gap-1.5 text-emerald-700">
                    <span>Palet: <b>{itemForm.palet_boyut}</b></span>
                    <span>Yüks: <b>{itemForm.palet_yukseklik}</b></span>
                    <span>Koli/Adet: <b>{itemForm.koli_adedi}</b></span>
                    <span>Plt Koli: <b>{itemForm.palette_koli}</b></span>
                  </div>
                </div>
              )}

              {/* Şablon bulunamadı — full form */}
              {selectedSku && !sablonLoading && !hasSablon && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Şablon bulunamadı. Lütfen değerleri girin.
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Palet Boyut</Label>
                      <Input className="h-8 text-xs" value={itemForm.palet_boyut} onChange={(e) => setItemForm((f) => ({ ...f, palet_boyut: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Palet Yükseklik</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.palet_yukseklik || ""} onChange={(e) => setItemForm((f) => ({ ...f, palet_yukseklik: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">En (cm)</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.en || ""} onChange={(e) => setItemForm((f) => ({ ...f, en: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Boy (cm)</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.boy || ""} onChange={(e) => setItemForm((f) => ({ ...f, boy: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Yükseklik (cm)</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.yuk || ""} onChange={(e) => setItemForm((f) => ({ ...f, yuk: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Adet/Koli</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.koli_adedi || ""} onChange={(e) => setItemForm((f) => ({ ...f, koli_adedi: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Palette Koli</Label>
                      <Input type="number" className="h-8 text-xs" value={itemForm.palette_koli || ""} onChange={(e) => setItemForm((f) => ({ ...f, palette_koli: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Koli Ağırlık (kg)</Label>
                      <Input type="number" step="0.1" className="h-8 text-xs" value={itemForm.koli_agirlik || ""} onChange={(e) => setItemForm((f) => ({ ...f, koli_agirlik: Number(e.target.value) }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Grup + Preview + Ekle */}
              {selectedSku && !sablonLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Grup (Opsiyonel)</Label>
                    <Input
                      className="h-9 text-xs"
                      placeholder="DTM1, DTM2..."
                      value={itemForm.grup}
                      onChange={(e) => setItemForm((f) => ({ ...f, grup: e.target.value }))}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>T. Koli: <b>{toplamKoli}</b></p>
                    <p>Adet: <b>{adet.toLocaleString("tr-TR")}</b></p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="h-9"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Listeye Ekle
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Toplamlar --- */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(() => {
              const t = items.reduce((acc, item) => ({
                palet: acc.palet + item.palet_sayisi,
                koli: acc.koli + (item.palette_koli * item.palet_sayisi),
                agirlik: acc.agirlik + (item.koli_agirlik * item.palette_koli * item.palet_sayisi),
                adet: acc.adet + (item.koli_adedi * item.palette_koli * item.palet_sayisi),
              }), { palet: 0, koli: 0, agirlik: 0, adet: 0 });
              return (
                <>
                  <div className="rounded-lg border bg-blue-50 p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium">Toplam Palet</p>
                    <p className="text-lg font-bold text-blue-700">{t.palet}</p>
                  </div>
                  <div className="rounded-lg border bg-purple-50 p-3 text-center">
                    <p className="text-xs text-purple-600 font-medium">Toplam Koli</p>
                    <p className="text-lg font-bold text-purple-700">{t.koli.toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-3 text-center">
                    <p className="text-xs text-amber-600 font-medium">Toplam Ağırlık</p>
                    <p className="text-lg font-bold text-amber-700">{t.agirlik.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kg</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">Toplam Adet</p>
                    <p className="text-lg font-bold text-emerald-700">{t.adet.toLocaleString("tr-TR")}</p>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* --- Submit --- */}
        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1 h-12"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Truck className="w-5 h-5 mr-2" />
            )}
            {loading ? "Oluşturuluyor..." : `Sevkiyat Oluştur${items.length > 0 ? ` (${items.length} ürün)` : ""}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => router.push("/sevkiyat")}
          >
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
