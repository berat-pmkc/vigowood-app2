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
import { Badge } from "@/components/ui/badge";
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
import { productUpdateSchema, type ProductUpdateData } from "@/lib/validations";
import { formatDate, formatNumber } from "@/lib/utils";
import { updateProduct } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductEditSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ProductEditSheet({
  product,
  open,
  onOpenChange,
  onSaved,
}: ProductEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductUpdateData>({
    resolver: zodResolver(productUpdateSchema),
  });

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      reset({
        urun_adi: product.urun_adi || "",
        kategori: product.kategori || PRODUCT_CATEGORIES[0],
        aktif_mi: product.aktif_mi,
      });
    }
  }, [product, reset]);

  const onSubmit = (data: ProductUpdateData) => {
    if (!product) return;

    startTransition(async () => {
      const result = await updateProduct(product.sku, data);
      if (result.success) {
        toast.success("Ürün güncellendi");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const aktifMi = watch("aktif_mi");
  const kategoriValue = watch("kategori");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">Ürün Düzenle</SheetTitle>
          <SheetDescription>
            {product?.sku}
          </SheetDescription>
        </SheetHeader>

        {product && (
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-6 pt-4">
            {/* Editable fields */}
            <div className="space-y-4">
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
                    setValue("kategori", v as ProductUpdateData["kategori"], {
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

            <Separator />

            {/* Read-only info */}
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
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
