"use client";

import { useEffect, useTransition } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { odemeCreateSchema, type OdemeCreateData } from "@/lib/validations";
import {
  ODEME_TURLERI,
  ODEME_TURU_LABELS,
  ODEME_DURUMLARI,
  PARA_BIRIMLERI,
} from "@/lib/constants";
import { createOdeme, updateOdeme } from "../actions";
import type { Odeme } from "@/lib/supabase/types";

interface OdemeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: Odeme | null;
}

export function OdemeFormSheet({
  open,
  onOpenChange,
  editingRecord,
}: OdemeFormSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!editingRecord;
  const todayStr = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<OdemeCreateData>({
    resolver: zodResolver(odemeCreateSchema),
    defaultValues: {
      tanimi: "",
      tutar: 0,
      cinsi: "TL",
      tarih: todayStr,
      turu: "GENEL",
      odeme_durum: "BEKLİYOR",
    },
  });

  const selectedTuru = watch("turu");
  const selectedCinsi = watch("cinsi");
  const selectedDurum = watch("odeme_durum");

  useEffect(() => {
    if (open) {
      if (editingRecord) {
        reset({
          tanimi: editingRecord.tanimi,
          tutar: Number(editingRecord.tutar),
          cinsi: (editingRecord.cinsi as OdemeCreateData["cinsi"]) || "TL",
          tarih: editingRecord.tarih || todayStr,
          turu: (editingRecord.turu as OdemeCreateData["turu"]) || "GENEL",
          odeme_durum: (editingRecord.odeme_durum as OdemeCreateData["odeme_durum"]) || "BEKLİYOR",
        });
      } else {
        reset({
          tanimi: "",
          tutar: 0,
          cinsi: "TL",
          tarih: todayStr,
          turu: "GENEL",
          odeme_durum: "BEKLİYOR",
        });
      }
    }
  }, [open, editingRecord, reset, todayStr]);

  const onSubmit = (data: OdemeCreateData) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateOdeme(editingRecord!.id, data)
        : await createOdeme(data);

      if (result.success) {
        toast.success(isEdit ? "Ödeme güncellendi" : "Ödeme oluşturuldu");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Ödeme Düzenle" : "Yeni Ödeme"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Tanım */}
          <div className="space-y-2">
            <Label htmlFor="tanimi">Tanım *</Label>
            <Input
              id="tanimi"
              placeholder="Ödeme tanımı..."
              {...register("tanimi")}
            />
            {errors.tanimi && (
              <p className="text-sm text-destructive">{errors.tanimi.message}</p>
            )}
          </div>

          {/* Tutar + Cinsi */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="tutar">Tutar *</Label>
              <Input
                id="tutar"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register("tutar", { valueAsNumber: true })}
              />
              {errors.tutar && (
                <p className="text-sm text-destructive">{errors.tutar.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cinsi</Label>
              <Select
                value={selectedCinsi}
                onValueChange={(v) =>
                  setValue("cinsi", v as OdemeCreateData["cinsi"], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARA_BIRIMLERI.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tarih */}
          <div className="space-y-2">
            <Label htmlFor="tarih">Tarih *</Label>
            <Input id="tarih" type="date" {...register("tarih")} />
            {errors.tarih && (
              <p className="text-sm text-destructive">{errors.tarih.message}</p>
            )}
          </div>

          {/* Tür */}
          <div className="space-y-2">
            <Label>Tür *</Label>
            <Select
              value={selectedTuru}
              onValueChange={(v) =>
                setValue("turu", v as OdemeCreateData["turu"], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tür seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {ODEME_TURLERI.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ODEME_TURU_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.turu && (
              <p className="text-sm text-destructive">{errors.turu.message}</p>
            )}
          </div>

          {/* Durum */}
          <div className="space-y-2">
            <Label>Durum *</Label>
            <Select
              value={selectedDurum}
              onValueChange={(v) =>
                setValue("odeme_durum", v as OdemeCreateData["odeme_durum"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ODEME_DURUMLARI.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.odeme_durum && (
              <p className="text-sm text-destructive">{errors.odeme_durum.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
