"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
import { sevkiyatFiyatSchema, type SevkiyatFiyatData } from "@/lib/validations";
import { SEVKIYAT_COUNTRIES } from "@/lib/constants";
import { createFiyat, updateFiyat, type FiyatRow } from "../actions";
import { toast } from "sonner";

interface FiyatEditSheetProps {
  fiyat: FiyatRow | null;
  isNew?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiyatEditSheet({ fiyat, isNew, open, onOpenChange }: FiyatEditSheetProps) {
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (open) {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "Yeni Fiyat" : "Fiyat Düzenle"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
                {Object.values(SEVKIYAT_COUNTRIES).map((c) => (
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

          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input id="sku" placeholder="VW-001" {...register("sku")} />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="urun_adi_en">Ürün Adı (EN)</Label>
            <Input
              id="urun_adi_en"
              placeholder="Product name in English"
              {...register("urun_adi_en", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gtip">GTIP (HS Code)</Label>
            <Input
              id="gtip"
              placeholder="9403.60.90.90.00"
              {...register("gtip", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="kategori">Kategori</Label>
            <Input
              id="kategori"
              placeholder="Kategori"
              {...register("kategori", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="asin">ASIN</Label>
            <Input
              id="asin"
              placeholder="B0XXXXXXXX"
              {...register("asin", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

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
