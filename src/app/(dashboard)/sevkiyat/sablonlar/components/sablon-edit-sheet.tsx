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
import { paletSablonSchema, type PaletSablonData } from "@/lib/validations";
import { SEVKIYAT_COUNTRIES, PALET_BOYUTLARI } from "@/lib/constants";
import { createPaletSablon, updatePaletSablon, type PaletSablonRow } from "../actions";
import { toast } from "sonner";

interface SablonEditSheetProps {
  sablon: PaletSablonRow | null;
  isNew?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SablonEditSheet({ sablon, isNew, open, onOpenChange }: SablonEditSheetProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaletSablonData>({
    resolver: zodResolver(paletSablonSchema),
  });

  const countryCode = watch("country_code");
  const paletBoyut = watch("palet_boyut");

  useEffect(() => {
    if (open) {
      if (sablon && !isNew) {
        reset({
          country_code: sablon.country_code as PaletSablonData["country_code"],
          sku: sablon.sku,
          urun_adi: sablon.urun_adi,
          palet_boyut: sablon.palet_boyut,
          palet_yukseklik: sablon.palet_yukseklik,
          en: sablon.en,
          boy: sablon.boy,
          yuk: sablon.yuk,
          koli_adedi: sablon.koli_adedi,
          palette_koli: sablon.palette_koli,
          koli_agirlik: sablon.koli_agirlik,
        });
      } else {
        reset({
          country_code: "DE",
          sku: "",
          urun_adi: null,
          palet_boyut: "80x120",
          palet_yukseklik: 125,
          en: 0,
          boy: 0,
          yuk: 0,
          koli_adedi: 1,
          palette_koli: 1,
          koli_agirlik: 1,
        });
      }
    }
  }, [open, sablon, isNew, reset]);

  const onSubmit = async (data: PaletSablonData) => {
    setLoading(true);
    const formData = {
      country_code: data.country_code,
      sku: data.sku,
      urun_adi: data.urun_adi || null,
      palet_boyut: data.palet_boyut,
      palet_yukseklik: data.palet_yukseklik,
      en: data.en,
      boy: data.boy,
      yuk: data.yuk,
      koli_adedi: data.koli_adedi,
      palette_koli: data.palette_koli,
      koli_agirlik: data.koli_agirlik,
    };

    const result = isNew
      ? await createPaletSablon(formData)
      : await updatePaletSablon(sablon!.id, formData);

    if (result.success) {
      toast.success(isNew ? "Şablon eklendi" : "Şablon güncellendi");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isNew ? "Yeni Palet Şablonu" : "Şablon Düzenle"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Ülke *</Label>
            <Select
              value={countryCode ?? "DE"}
              onValueChange={(v) => setValue("country_code", v as PaletSablonData["country_code"])}
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
            <Input id="sku" placeholder="LS051" {...register("sku")} />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="urun_adi">Ürün Adı</Label>
            <Input
              id="urun_adi"
              placeholder="Ürün adı"
              {...register("urun_adi", { setValueAs: (v: string) => v === "" ? null : v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Palet Boyutu *</Label>
              <Select
                value={paletBoyut ?? "80x120"}
                onValueChange={(v) => setValue("palet_boyut", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALET_BOYUTLARI.map((b) => (
                    <SelectItem key={b} value={b}>{b} cm</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="palet_yukseklik">Palet Yükseklik (cm) *</Label>
              <Input
                id="palet_yukseklik"
                type="number"
                step="1"
                {...register("palet_yukseklik", { valueAsNumber: true })}
              />
              {errors.palet_yukseklik && (
                <p className="text-sm text-destructive">{errors.palet_yukseklik.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="en">En (cm) *</Label>
              <Input
                id="en"
                type="number"
                step="0.1"
                {...register("en", { valueAsNumber: true })}
              />
              {errors.en && (
                <p className="text-sm text-destructive">{errors.en.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="boy">Boy (cm) *</Label>
              <Input
                id="boy"
                type="number"
                step="0.1"
                {...register("boy", { valueAsNumber: true })}
              />
              {errors.boy && (
                <p className="text-sm text-destructive">{errors.boy.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="yuk">Yük (cm) *</Label>
              <Input
                id="yuk"
                type="number"
                step="0.1"
                {...register("yuk", { valueAsNumber: true })}
              />
              {errors.yuk && (
                <p className="text-sm text-destructive">{errors.yuk.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="koli_adedi">Adet/Koli *</Label>
              <Input
                id="koli_adedi"
                type="number"
                {...register("koli_adedi", { valueAsNumber: true })}
              />
              {errors.koli_adedi && (
                <p className="text-sm text-destructive">{errors.koli_adedi.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="palette_koli">Koli/Palet *</Label>
              <Input
                id="palette_koli"
                type="number"
                {...register("palette_koli", { valueAsNumber: true })}
              />
              {errors.palette_koli && (
                <p className="text-sm text-destructive">{errors.palette_koli.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="koli_agirlik">kg/Koli *</Label>
              <Input
                id="koli_agirlik"
                type="number"
                step="0.1"
                {...register("koli_agirlik", { valueAsNumber: true })}
              />
              {errors.koli_agirlik && (
                <p className="text-sm text-destructive">{errors.koli_agirlik.message}</p>
              )}
            </div>
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
