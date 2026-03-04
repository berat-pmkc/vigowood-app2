"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateData,
  type ProductUpdateData,
} from "@/lib/validations";
import { formatDate, formatNumber } from "@/lib/utils";
import { createProduct, updateProduct } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductEditSheetProps {
  product: Product | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ProductEditSheet({
  product,
  mode,
  open,
  onOpenChange,
  onSaved,
}: ProductEditSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isCreate = mode === "create";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductUpdateData & { sku?: string }>({
    resolver: zodResolver(isCreate ? productCreateSchema : productUpdateSchema) as any,
  });

  // Reset form when product/mode changes
  useEffect(() => {
    if (isCreate) {
      reset({
        sku: "",
        urun_adi: "",
        kategori: PRODUCT_CATEGORIES[0],
        aktif_mi: true,
      } as ProductUpdateData);
    } else if (product) {
      reset({
        sku: product.sku,
        urun_adi: product.urun_adi || "",
        kategori: product.kategori || PRODUCT_CATEGORIES[0],
        aktif_mi: product.aktif_mi,
        kutu_boy_cm: product.kutu_boy_cm ?? null,
        kutu_en_cm: product.kutu_en_cm ?? null,
        kutu_yukseklik_cm: product.kutu_yukseklik_cm ?? null,
        urun_agirlik_kg: product.urun_agirlik_kg ?? null,
        kutu_agirlik_kg: product.kutu_agirlik_kg ?? null,
      } as ProductUpdateData);
    }
  }, [product, isCreate, reset, open]);

  const boyVal = watch("kutu_boy_cm");
  const enVal = watch("kutu_en_cm");
  const yukVal = watch("kutu_yukseklik_cm");
  const desiCalc = boyVal && enVal && yukVal ? Math.round((boyVal * enVal * yukVal) / 3000 * 100) / 100 : null;

  const onSubmit = (data: ProductUpdateData) => {
    startTransition(async () => {
      if (isCreate) {
        const result = await createProduct(data as ProductCreateData);
        if (result.success) {
          toast.success(`${(data as ProductCreateData).sku} oluşturuldu`);
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      } else {
        if (!product) return;
        const result = await updateProduct(product.sku, {
          urun_adi: data.urun_adi,
          kategori: data.kategori,
          aktif_mi: data.aktif_mi,
          kutu_boy_cm: data.kutu_boy_cm,
          kutu_en_cm: data.kutu_en_cm,
          kutu_yukseklik_cm: data.kutu_yukseklik_cm,
          urun_agirlik_kg: data.urun_agirlik_kg,
          kutu_agirlik_kg: data.kutu_agirlik_kg,
        });
        if (result.success) {
          toast.success("Ürün güncellendi");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const aktifMi = watch("aktif_mi");
  const kategoriValue = watch("kategori");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isCreate ? "Yeni Ürün" : "Ürün Düzenle"}
          </SheetTitle>
          <SheetDescription>
            {isCreate ? "Yeni ürün oluşturun" : product?.sku}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-6 pt-4">
          {/* Editable fields */}
          <div className="space-y-4">
            {/* SKU — only in create mode */}
            {isCreate && (
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  {...register("sku")}
                  placeholder="ör: VW-KEDI-EVI-001"
                />
                {errors.sku && (
                  <p className="text-sm text-destructive">{errors.sku.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="urun_adi">Ürün Adı</Label>
              <Input
                id="urun_adi"
                {...register("urun_adi")}
                placeholder="Ürün adı..."
              />
              {errors.urun_adi && (
                <p className="text-sm text-destructive">{errors.urun_adi.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kategori">Kategori</Label>
              <Select
                value={kategoriValue}
                onValueChange={(v) =>
                  setValue("kategori", v as ProductCreateData["kategori"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.kategori && (
                <p className="text-sm text-destructive">{errors.kategori.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="aktif_mi"
                checked={aktifMi}
                onCheckedChange={(checked) =>
                  setValue("aktif_mi", !!checked, { shouldValidate: true })
                }
              />
              <Label htmlFor="aktif_mi" className="cursor-pointer">
                Aktif ürün
              </Label>
            </div>
          </div>

          {/* Kutu Bilgileri — only in edit mode */}
          {!isCreate && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Kutu Bilgileri
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="kutu_boy_cm" className="text-xs">Boy (cm)</Label>
                    <Input
                      id="kutu_boy_cm"
                      type="number"
                      step="0.01"
                      {...register("kutu_boy_cm", { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : Number(v) })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kutu_en_cm" className="text-xs">En (cm)</Label>
                    <Input
                      id="kutu_en_cm"
                      type="number"
                      step="0.01"
                      {...register("kutu_en_cm", { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : Number(v) })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kutu_yukseklik_cm" className="text-xs">Yükseklik (cm)</Label>
                    <Input
                      id="kutu_yukseklik_cm"
                      type="number"
                      step="0.01"
                      {...register("kutu_yukseklik_cm", { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : Number(v) })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="urun_agirlik_kg" className="text-xs">Ürün Ağırlığı (kg)</Label>
                    <Input
                      id="urun_agirlik_kg"
                      type="number"
                      step="0.001"
                      {...register("urun_agirlik_kg", { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : Number(v) })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kutu_agirlik_kg" className="text-xs">Kutu Ağırlığı (kg)</Label>
                    <Input
                      id="kutu_agirlik_kg"
                      type="number"
                      step="0.001"
                      {...register("kutu_agirlik_kg", { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : Number(v) })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desi</Label>
                    <div className="h-8 flex items-center px-3 rounded-md border bg-muted text-sm font-mono">
                      {desiCalc ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Read-only info — only in edit mode */}
          {!isCreate && product && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  İstatistikler (salt okunur)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Stok</span>
                    <p className={`font-mono font-medium ${product.stok_aktif < 0 ? "text-vw-error" : ""}`}>
                      {formatNumber(product.stok_aktif)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Toplam Satış</span>
                    <p className="font-mono font-medium">{formatNumber(product.toplam_satis)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Günlük Satış</span>
                    <p className="font-mono font-medium">{formatNumber(product.gunluk_satis)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aylık Üretim</span>
                    <p className="font-mono font-medium">{formatNumber(product.aylik_uretim)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Geçen Ay Üretim</span>
                    <p className="font-mono font-medium">{formatNumber(product.gecen_ay_uretim)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Satılan Gün</span>
                    <p className="font-mono font-medium">{formatNumber(product.satilan_gun_sayisi)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">İlk Satış Tarihi</span>
                    <p className="font-medium">{formatDate(product.ilk_satis_tarihi)}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Kaydediliyor..."
                : isCreate
                  ? "Oluştur"
                  : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
