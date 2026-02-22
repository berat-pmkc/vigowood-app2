"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Separator } from "@/components/ui/separator";
import { formatNumber } from "@/lib/utils";
import { createHazirEleman, updateHazirEleman } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

const hazirElemanSchema = z.object({
  part_id: z.string().min(1, "Kod gereklidir"),
  part_adi: z
    .string()
    .min(1, "Hazır eleman adı gereklidir")
    .max(200, "Ad en fazla 200 karakter olabilir"),
  hazir_eleman_kritik_stok: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Kritik stok 0 veya üzeri olmalıdır"),
  mdf_tipi: z.string().optional(),
  mdf_renk: z.string().optional(),
});

type FormData = z.infer<typeof hazirElemanSchema>;

export type ElemanPrefix = "HP" | "MDF";

interface HazirElemanEditSheetProps {
  part: AllPart | null;
  mode: "create" | "edit";
  nextCode: string;
  prefix: ElemanPrefix;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function getStokStatus(part: AllPart): "critical" | "warning" | "ok" {
  const stok = part.hazir_eleman_aktif_stok;
  const kritik = part.hazir_eleman_kritik_stok;
  if (kritik <= 0) return "ok";
  if (stok <= 0 || stok < kritik) return "critical";
  if (stok <= kritik * 1.5) return "warning";
  return "ok";
}

export function HazirElemanEditSheet({
  part,
  mode,
  nextCode,
  prefix,
  open,
  onOpenChange,
  onSaved,
}: HazirElemanEditSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isCreate = mode === "create";
  const isMDF = isCreate ? prefix === "MDF" : !!part?.mdf_tipi;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(hazirElemanSchema),
  });

  useEffect(() => {
    if (isCreate) {
      reset({
        part_id: nextCode,
        part_adi: "",
        hazir_eleman_kritik_stok: 0,
        mdf_tipi: "",
        mdf_renk: "",
      });
    } else if (part) {
      reset({
        part_id: part.part_id,
        part_adi: part.part_adi || "",
        hazir_eleman_kritik_stok: part.hazir_eleman_kritik_stok,
        mdf_tipi: part.mdf_tipi || "",
        mdf_renk: part.mdf_renk || "",
      });
    }
  }, [part, isCreate, nextCode, reset, open]);

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      if (isCreate) {
        const result = await createHazirEleman({
          part_id: data.part_id,
          part_adi: data.part_adi,
          hazir_eleman_kritik_stok: data.hazir_eleman_kritik_stok,
          mdf_tipi: isMDF ? data.mdf_tipi || null : null,
          mdf_renk: isMDF ? data.mdf_renk || null : null,
        });
        if (result.success) {
          toast.success(`${data.part_id} oluşturuldu`);
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      } else {
        if (!part) return;
        const result = await updateHazirEleman(part.part_id, {
          part_adi: data.part_adi,
          hazir_eleman_kritik_stok: data.hazir_eleman_kritik_stok,
          mdf_tipi: isMDF ? data.mdf_tipi || null : null,
          mdf_renk: isMDF ? data.mdf_renk || null : null,
        });
        if (result.success) {
          toast.success("Hazır eleman güncellendi");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isCreate ? "Yeni Hazır Eleman" : "Hazır Eleman Düzenle"}
          </SheetTitle>
          <SheetDescription>
            {isCreate
              ? "Yeni hazır eleman tanımlayın"
              : part?.part_id}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-6 pb-6 space-y-6 pt-4"
        >
          <div className="space-y-4">
            {/* Tip badge */}
            {isMDF && (
              <Badge className="bg-vw-info/20 text-vw-info border-vw-info/30">
                MDF Hammadde
              </Badge>
            )}

            {/* Kod — auto-generated in create, read-only in edit */}
            <div className="space-y-2">
              <Label htmlFor="part_id">Hazır Eleman Kodu</Label>
              <Input
                id="part_id"
                {...register("part_id")}
                readOnly={!isCreate}
                className={!isCreate ? "bg-muted" : ""}
                placeholder={isMDF ? "MDF0001" : "HP0001"}
              />
              {isCreate && (
                <p className="text-xs text-muted-foreground">
                  Otomatik oluşturuldu, değiştirebilirsiniz
                </p>
              )}
              {errors.part_id && (
                <p className="text-sm text-destructive">
                  {errors.part_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="part_adi">Hazır Eleman Adı</Label>
              <Input
                id="part_adi"
                {...register("part_adi")}
                placeholder={isMDF ? "8mm MDF Ceviz..." : "Menteşe, vida, mıknatıs..."}
              />
              {errors.part_adi && (
                <p className="text-sm text-destructive">
                  {errors.part_adi.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hazir_eleman_kritik_stok">
                Kritik Stok Seviyesi
              </Label>
              <Input
                id="hazir_eleman_kritik_stok"
                type="number"
                min={0}
                {...register("hazir_eleman_kritik_stok", {
                  valueAsNumber: true,
                })}
                placeholder="0"
              />
              {errors.hazir_eleman_kritik_stok && (
                <p className="text-sm text-destructive">
                  {errors.hazir_eleman_kritik_stok.message}
                </p>
              )}
            </div>

            {/* MDF Tipi + Renk — sadece MDF elemanları için */}
            {isMDF && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">
                  MDF Plaka Eşleştirme
                </p>
                <p className="text-xs text-muted-foreground">
                  Plaka tablosundaki tipi ve renk ile eşleşecek değerleri girin.
                  Kesim tamamlandığında bu MDF&apos;in stoğu otomatik düşecek.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="mdf_tipi">MDF Tipi</Label>
                    <Input
                      id="mdf_tipi"
                      {...register("mdf_tipi")}
                      placeholder="ör: 8mm MDF"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mdf_renk">MDF Renk</Label>
                    <Input
                      id="mdf_renk"
                      {...register("mdf_renk")}
                      placeholder="ör: Ceviz"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Read-only stok info — edit mode only */}
          {!isCreate && part && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Stok Bilgileri (salt okunur)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Mevcut Stok</span>
                    <p
                      className={`font-mono font-medium ${
                        getStokStatus(part) === "critical"
                          ? "text-vw-error"
                          : getStokStatus(part) === "warning"
                            ? "text-vw-warning"
                            : ""
                      }`}
                    >
                      {formatNumber(part.hazir_eleman_aktif_stok)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Durum</span>
                    <div className="mt-0.5">
                      {part.hazir_eleman_kritik_stok <= 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          —
                        </Badge>
                      ) : getStokStatus(part) === "critical" ? (
                        <Badge className="bg-vw-error/20 text-vw-error border-vw-error/30 text-xs">
                          Kritik
                        </Badge>
                      ) : getStokStatus(part) === "warning" ? (
                        <Badge className="bg-vw-warning/20 text-vw-warning border-vw-warning/30 text-xs">
                          Düşük
                        </Badge>
                      ) : (
                        <Badge className="bg-vw-success/20 text-vw-success border-vw-success/30 text-xs">
                          Yeterli
                        </Badge>
                      )}
                    </div>
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
