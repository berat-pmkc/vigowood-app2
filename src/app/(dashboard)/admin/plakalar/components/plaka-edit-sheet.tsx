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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MAKINE_IDS, MAKINE_LABELS } from "@/lib/constants";
import { plakaUpdateSchema, type PlakaUpdateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { updatePlaka } from "../actions";
import { PlakaPartsPanel } from "./plaka-parts-panel";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

interface PlakaEditSheetProps {
  plaka: Plaka | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PlakaEditSheet({
  plaka,
  open,
  onOpenChange,
  onSaved,
}: PlakaEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PlakaUpdateData>({
    resolver: zodResolver(plakaUpdateSchema),
  });

  useEffect(() => {
    if (plaka) {
      reset({
        plaka_adi: plaka.plaka_adi || "",
        tipi: plaka.tipi || null,
        renk: plaka.renk || null,
        makine_id: plaka.makine_id as PlakaUpdateData["makine_id"],
        std_kesim_suresi_dk: plaka.std_kesim_suresi_dk,
        sku: plaka.sku || null,
      });
    }
  }, [plaka, reset]);

  const onSubmit = (data: PlakaUpdateData) => {
    if (!plaka) return;

    startTransition(async () => {
      const result = await updatePlaka(plaka.plakalar_id, data);
      if (result.success) {
        toast.success("Plaka güncellendi");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const makineValue = watch("makine_id");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Plaka Düzenle</SheetTitle>
          <SheetDescription>
            {plaka?.plakalar_id} — {plaka?.plaka_id}
          </SheetDescription>
        </SheetHeader>

        {plaka && (
          <div className="space-y-6 pt-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
            >
              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plaka_adi">Plaka Adı</Label>
                  <Input
                    id="plaka_adi"
                    {...register("plaka_adi")}
                    placeholder="Plaka adı..."
                  />
                  {errors.plaka_adi && (
                    <p className="text-sm text-destructive">
                      {errors.plaka_adi.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="tipi">Tip</Label>
                    <Input
                      id="tipi"
                      {...register("tipi")}
                      placeholder="ör: 8mm MDF"
                    />
                    {errors.tipi && (
                      <p className="text-sm text-destructive">
                        {errors.tipi.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="renk">Renk</Label>
                    <Input
                      id="renk"
                      {...register("renk")}
                      placeholder="ör: Ceviz"
                    />
                    {errors.renk && (
                      <p className="text-sm text-destructive">
                        {errors.renk.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="makine_id">Kesim Makinesi</Label>
                  <Select
                    value={makineValue}
                    onValueChange={(v) =>
                      setValue(
                        "makine_id",
                        v as PlakaUpdateData["makine_id"],
                        { shouldValidate: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Makine seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAKINE_IDS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {MAKINE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.makine_id && (
                    <p className="text-sm text-destructive">
                      {errors.makine_id.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="std_kesim_suresi_dk">
                      Kesim Süresi (dk)
                    </Label>
                    <Input
                      id="std_kesim_suresi_dk"
                      type="number"
                      min={0}
                      {...register("std_kesim_suresi_dk", {
                        setValueAs: (v) =>
                          v === "" || v === null || v === undefined
                            ? null
                            : Number(v),
                      })}
                      placeholder="0"
                    />
                    {errors.std_kesim_suresi_dk && (
                      <p className="text-sm text-destructive">
                        {errors.std_kesim_suresi_dk.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU (Ürün)</Label>
                    <Input
                      id="sku"
                      {...register("sku", {
                        setValueAs: (v) =>
                          v === "" ? null : v,
                      })}
                      placeholder="ör: VW-001"
                    />
                    {errors.sku && (
                      <p className="text-sm text-destructive">
                        {errors.sku.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Read-only info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Bilgiler (salt okunur)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plaka Grubu</span>
                    <p className="font-mono font-medium">{plaka.plaka_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturulma</span>
                    <p className="font-medium">{formatDate(plaka.created_at)}</p>
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

            <Separator />

            {/* PlakaParts management */}
            <PlakaPartsPanel
              plakaId={plaka.plaka_id}
              sku={plaka.sku}
              open={open}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
