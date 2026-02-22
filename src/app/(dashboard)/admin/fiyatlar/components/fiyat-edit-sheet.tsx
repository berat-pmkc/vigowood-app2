"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { sevkiyatFiyatSchema, type SevkiyatFiyatData } from "@/lib/validations";
import type { ShipmentCountry } from "@/lib/shipment-settings-types";
import { createFiyat, updateFiyat, type FiyatRow } from "../actions";
import { toast } from "sonner";

export interface ProductOption {
  sku: string;
  urun_adi: string | null;
}

interface FiyatEditSheetProps {
  fiyat: FiyatRow | null;
  isNew?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  ulkeler: ShipmentCountry[];
}

export function FiyatEditSheet({ fiyat, isNew, open, onOpenChange, products, ulkeler }: FiyatEditSheetProps) {
  const [loading, setLoading] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SevkiyatFiyatData>({
    resolver: zodResolver(sevkiyatFiyatSchema),
  });

  const countryCode = watch("country_code");
  const selectedSku = watch("sku");

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          (p.urun_adi && p.urun_adi.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [products, productSearch]);

  useEffect(() => {
    if (open) {
      setProductSearch("");
      if (fiyat && !isNew) {
        reset({
          country_code: fiyat.country_code as SevkiyatFiyatData["country_code"],
          sku: fiyat.sku,
          urun_adi_en: fiyat.urun_adi_en,
          gtip: fiyat.gtip,
          birim_fiyat: fiyat.birim_fiyat,
          kategori: fiyat.kategori,
          package_qty: fiyat.package_qty,
          asin: fiyat.asin,
        });
      } else {
        reset({
          country_code: "DE",
          sku: "",
          urun_adi_en: null,
          gtip: null,
          birim_fiyat: 0,
          kategori: null,
          package_qty: null,
          asin: null,
        });
      }
    }
  }, [open, fiyat, isNew, reset]);

  const onSubmit = async (data: SevkiyatFiyatData) => {
    setLoading(true);
    const formData = {
      country_code: data.country_code,
      sku: data.sku,
      urun_adi_en: data.urun_adi_en || null,
      gtip: data.gtip || null,
      birim_fiyat: data.birim_fiyat,
      kategori: data.kategori || null,
      package_qty: data.package_qty ?? null,
      asin: data.asin || null,
    };

    const result = isNew
      ? await createFiyat(formData)
      : await updateFiyat(fiyat!.id, formData);

    if (result.success) {
      toast.success(isNew ? "Fiyat eklendi" : "Fiyat güncellendi");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleProductSelect = (sku: string) => {
    setValue("sku", sku, { shouldValidate: true });
    setProductOpen(false);
    setProductSearch("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isNew ? "Yeni Fiyat Ekle" : "Fiyat Düzenle"}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? "Ürün seçerek yeni fiyat kaydı oluşturun"
              : `${fiyat?.sku ?? ""} - ${fiyat?.country_code ?? ""}`}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 mt-4 space-y-4">
          {/* Ülke */}
          <div className="space-y-2">
            <Label>Ülke *</Label>
            <Select
              value={countryCode ?? "DE"}
              onValueChange={(v) => setValue("country_code", v as SevkiyatFiyatData["country_code"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ülke seçin" />
              </SelectTrigger>
              <SelectContent>
                {ulkeler.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country_code && (
              <p className="text-sm text-destructive">{errors.country_code.message}</p>
            )}
          </div>

          {/* Ürün (SKU) Seçimi */}
          <div className="space-y-2">
            <Label>Ürün (SKU) *</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedSku
                    ? (() => {
                        const found = products.find((p) => p.sku === selectedSku);
                        return found
                          ? `${found.sku} — ${found.urun_adi || ""}`
                          : selectedSku;
                      })()
                    : "Ürün seçin..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="SKU veya ürün adı ara..."
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((p) => (
                        <CommandItem
                          key={p.sku}
                          value={p.sku}
                          onSelect={() => handleProductSelect(p.sku)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSku === p.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-sm mr-2">{p.sku}</span>
                          <span className="text-muted-foreground text-sm truncate">
                            {p.urun_adi || ""}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          {/* Ürün Adı EN */}
          <div className="space-y-2">
            <Label htmlFor="urun_adi_en">Ürün Adı (EN)</Label>
            <Input
              id="urun_adi_en"
              placeholder="Product name in English"
              {...register("urun_adi_en", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          {/* GTIP */}
          <div className="space-y-2">
            <Label htmlFor="gtip">GTIP (HS Code)</Label>
            <Input
              id="gtip"
              placeholder="9403.60.90.90.00"
              {...register("gtip", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          {/* Birim Fiyat */}
          <div className="space-y-2">
            <Label htmlFor="birim_fiyat">Birim Fiyat *</Label>
            <Input
              id="birim_fiyat"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("birim_fiyat", { valueAsNumber: true })}
            />
            {errors.birim_fiyat && (
              <p className="text-sm text-destructive">{errors.birim_fiyat.message}</p>
            )}
          </div>

          {/* Kategori */}
          <div className="space-y-2">
            <Label htmlFor="kategori">Kategori</Label>
            <Input
              id="kategori"
              placeholder="Kategori"
              {...register("kategori", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          {/* Package Qty */}
          <div className="space-y-2">
            <Label htmlFor="package_qty">Paket Adedi</Label>
            <Input
              id="package_qty"
              type="number"
              placeholder="1"
              {...register("package_qty", {
                setValueAs: (v: string) => v === "" ? null : Number(v),
              })}
            />
          </div>

          {/* ASIN */}
          <div className="space-y-2">
            <Label htmlFor="asin">ASIN</Label>
            <Input
              id="asin"
              placeholder="B0XXXXXXXX"
              {...register("asin", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 h-11" disabled={loading}>
              {loading ? "Kaydediliyor..." : isNew ? "Ekle" : "Güncelle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
