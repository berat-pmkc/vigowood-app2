"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createSkuMapping, updateSkuMapping } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type SkuMapping = Database["public"]["Tables"]["sku_mappings"]["Row"];

interface FormValues {
  master_sku: string;
  channel: string;
  channel_sku: string;
  channel_barcode: string;
  channel_product_code: string;
  channel_product_name: string;
  channel_product_id: string;
  match_method: string;
  match_status: string;
}

interface MappingEditSheetProps {
  mapping: SkuMapping | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function MappingEditSheet({
  mapping,
  mode,
  open,
  onOpenChange,
  onSaved,
}: MappingEditSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isCreate = mode === "create";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (isCreate) {
      reset({
        master_sku: "",
        channel: "trendyol",
        channel_sku: "",
        channel_barcode: "",
        channel_product_code: "",
        channel_product_name: "",
        channel_product_id: "",
        match_method: "manuel",
        match_status: "matched",
      });
    } else if (mapping) {
      reset({
        master_sku: mapping.master_sku || "",
        channel: mapping.channel || "trendyol",
        channel_sku: mapping.channel_sku || "",
        channel_barcode: mapping.channel_barcode || "",
        channel_product_code: mapping.channel_product_code || "",
        channel_product_name: mapping.channel_product_name || "",
        channel_product_id: mapping.channel_product_id || "",
        match_method: mapping.match_method || "",
        match_status: mapping.match_status || "matched",
      });
    }
  }, [mapping, isCreate, reset, open]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      if (isCreate) {
        const result = await createSkuMapping(data);
        if (result.success) {
          toast.success("Eşleştirme oluşturuldu");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      } else if (mapping) {
        const result = await updateSkuMapping(mapping.id, {
          master_sku: data.master_sku,
          channel_sku: data.channel_sku || undefined,
          channel_barcode: data.channel_barcode || undefined,
          channel_product_code: data.channel_product_code || undefined,
          channel_product_name: data.channel_product_name || undefined,
          match_method: data.match_method || undefined,
          match_status: data.match_status || undefined,
        });
        if (result.success) {
          toast.success("Eşleştirme güncellendi");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const channelValue = watch("channel");
  const statusValue = watch("match_status");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isCreate ? "Yeni Eşleştirme" : "Eşleştirme Düzenle"}
          </SheetTitle>
          <SheetDescription>
            {isCreate
              ? "Yeni kanal eşleştirmesi oluşturun"
              : `${mapping?.channel} — ${mapping?.channel_sku || mapping?.channel_barcode}`}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="master_sku">Master SKU</Label>
              <Input
                id="master_sku"
                {...register("master_sku", { required: "Zorunlu alan" })}
                placeholder="ör: TABLO"
              />
              {errors.master_sku && (
                <p className="text-sm text-destructive">{errors.master_sku.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">Kanal</Label>
              <Select
                value={channelValue}
                onValueChange={(v) => setValue("channel", v)}
                disabled={!isCreate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kanal seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trendyol">Trendyol</SelectItem>
                  <SelectItem value="ikas">İkas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel_sku">Kanal Stok Kodu</Label>
              <Input
                id="channel_sku"
                {...register("channel_sku")}
                placeholder="Kanalda kullanılan SKU"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel_barcode">Barkod</Label>
              <Input
                id="channel_barcode"
                {...register("channel_barcode")}
                placeholder="Kanal barkodu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel_product_code">Ürün Kodu</Label>
              <Input
                id="channel_product_code"
                {...register("channel_product_code")}
                placeholder="Kanal ürün kodu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel_product_name">Ürün Adı</Label>
              <Input
                id="channel_product_name"
                {...register("channel_product_name")}
                placeholder="Kanal ürün adı"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_method">Eşleşme Yöntemi</Label>
              <Input
                id="match_method"
                {...register("match_method")}
                placeholder="ör: manuel, Stok Kodu = Stok Kodu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_status">Durum</Label>
              <Select
                value={statusValue}
                onValueChange={(v) => setValue("match_status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matched">Eşleşti</SelectItem>
                  <SelectItem value="unmatched">Eşleşmedi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Read-only info for edit */}
          {!isCreate && mapping && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Bilgi (salt okunur)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Kanal Ürün ID</span>
                    <p className="font-mono text-xs">{mapping.channel_product_id || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturulma</span>
                    <p className="text-xs">
                      {mapping.created_at
                        ? new Date(mapping.created_at).toLocaleDateString("tr-TR")
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

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
