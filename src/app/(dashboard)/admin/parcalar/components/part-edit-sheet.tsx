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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PART_TYPES, PART_TYPE_LABELS } from "@/lib/constants";
import { partUpdateSchema, type PartUpdateData } from "@/lib/validations";
import { formatNumber } from "@/lib/utils";
import { updatePart } from "../actions";
import { toast } from "sonner";
import type { Database, PartType } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface PartEditSheetProps {
  part: AllPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function getStok(part: AllPart): number {
  return part.part_type === "YARIMAMUL"
    ? part.yari_mamul_stok
    : part.hazir_eleman_aktif_stok;
}

function getStokStatus(part: AllPart): "critical" | "warning" | "ok" {
  const stok = getStok(part);
  const kritik = part.hazir_eleman_kritik_stok;
  if (kritik <= 0) return "ok";
  if (stok <= 0 || stok < kritik) return "critical";
  if (stok <= kritik * 1.5) return "warning";
  return "ok";
}

export function PartEditSheet({
  part,
  open,
  onOpenChange,
  onSaved,
}: PartEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PartUpdateData>({
    resolver: zodResolver(partUpdateSchema),
  });

  useEffect(() => {
    if (part) {
      reset({
        part_adi: part.part_adi || "",
        part_type: part.part_type,
        hazir_eleman_kritik_stok: part.hazir_eleman_kritik_stok,
      });
    }
  }, [part, reset]);

  const onSubmit = (data: PartUpdateData) => {
    if (!part) return;

    startTransition(async () => {
      const result = await updatePart(part.part_id, data);
      if (result.success) {
        toast.success("Parça güncellendi");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const partTypeValue = watch("part_type");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Parça Düzenle</SheetTitle>
          <SheetDescription>{part?.part_id}</SheetDescription>
        </SheetHeader>

        {part && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* Editable fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="part_adi">Parça Adı</Label>
                <Input
                  id="part_adi"
                  {...register("part_adi")}
                  placeholder="Parça adı..."
                />
                {errors.part_adi && (
                  <p className="text-sm text-destructive">
                    {errors.part_adi.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="part_type">Parça Tipi</Label>
                <Select
                  value={partTypeValue}
                  onValueChange={(v) =>
                    setValue("part_type", v as PartUpdateData["part_type"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tip seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PART_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.part_type && (
                  <p className="text-sm text-destructive">
                    {errors.part_type.message}
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
            </div>

            <Separator />

            {/* Read-only info */}
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
                    {formatNumber(getStok(part))}
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
                {part.part_type === "YARIMAMUL" && (
                  <div>
                    <span className="text-muted-foreground">
                      Yarı Mamül Stok
                    </span>
                    <p className="font-mono font-medium">
                      {formatNumber(part.yari_mamul_stok)}
                    </p>
                  </div>
                )}
                {part.part_type !== "YARIMAMUL" && (
                  <div>
                    <span className="text-muted-foreground">
                      Hazır Eleman Stok
                    </span>
                    <p className="font-mono font-medium">
                      {formatNumber(part.hazir_eleman_aktif_stok)}
                    </p>
                  </div>
                )}
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
