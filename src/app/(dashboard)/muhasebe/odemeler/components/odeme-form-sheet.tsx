"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { odemeCreateSchema, type OdemeCreateData } from "@/lib/validations";
import {
  ODEME_TURLERI,
  ODEME_TURU_LABELS,
  ODEME_TURU_COLORS,
  ODEME_DURUMLARI,
  PARA_BIRIMLERI,
  type OdemeTuruConst,
} from "@/lib/constants";
import { createOdeme, updateOdeme, getDistinctKrediGruplari } from "../actions";
import type { Odeme } from "@/lib/supabase/types";

interface OdemeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: Odeme | null;
  prefillDate?: string | null;
}

export function OdemeFormSheet({
  open,
  onOpenChange,
  editingRecord,
  prefillDate,
}: OdemeFormSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!editingRecord;
  const todayStr = new Date().toISOString().split("T")[0];

  // Kredi grubu combobox state
  const [krediGruplari, setKrediGruplari] = useState<string[]>([]);
  const [krediGrubuInput, setKrediGrubuInput] = useState("");

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
      kredi_grubu: null,
    },
  });

  const selectedTuru = watch("turu");
  const selectedCinsi = watch("cinsi");
  const selectedDurum = watch("odeme_durum");

  // Kredi gruplarını yükle
  useEffect(() => {
    if (open) {
      getDistinctKrediGruplari().then(setKrediGruplari);
    }
  }, [open]);

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
          kredi_grubu: editingRecord.kredi_grubu || null,
        });
        setKrediGrubuInput(editingRecord.kredi_grubu || "");
      } else {
        reset({
          tanimi: "",
          tutar: 0,
          cinsi: "TL",
          tarih: prefillDate || todayStr,
          turu: "GENEL",
          odeme_durum: "BEKLİYOR",
          kredi_grubu: null,
        });
        setKrediGrubuInput("");
      }
    }
  }, [open, editingRecord, reset, todayStr, prefillDate]);

  // Sync kredi_grubu input → form
  useEffect(() => {
    if (selectedTuru === "KREDİ") {
      setValue("kredi_grubu", krediGrubuInput || null);
    } else {
      setValue("kredi_grubu", null);
    }
  }, [krediGrubuInput, selectedTuru, setValue]);

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
          <div className="space-y-2">
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

          {/* Madde 11: Cinsi — buton grubu */}
          <div className="space-y-2">
            <Label>Para Birimi</Label>
            <div className="flex gap-1.5">
              {PARA_BIRIMLERI.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={selectedCinsi === p ? "default" : "outline"}
                  className="h-8 px-4 text-xs"
                  onClick={() => setValue("cinsi", p as OdemeCreateData["cinsi"], { shouldValidate: true })}
                >
                  {p}
                </Button>
              ))}
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

          {/* Madde 11: Tür — buton grubu */}
          <div className="space-y-2">
            <Label>Tür *</Label>
            <div className="flex flex-wrap gap-1.5">
              {ODEME_TURLERI.map((t) => {
                const colors = ODEME_TURU_COLORS[t as OdemeTuruConst];
                const isSelected = selectedTuru === t;
                return (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] border"
                    style={
                      isSelected
                        ? { backgroundColor: colors?.bg, color: colors?.text, borderColor: colors?.text }
                        : {}
                    }
                    onClick={() => setValue("turu", t as OdemeCreateData["turu"], { shouldValidate: true })}
                  >
                    {ODEME_TURU_LABELS[t as OdemeTuruConst]}
                  </Button>
                );
              })}
            </div>
            {errors.turu && (
              <p className="text-sm text-destructive">{errors.turu.message}</p>
            )}
          </div>

          {/* Madde 9: Kredi grubu (conditional) */}
          {selectedTuru === "KREDİ" && (
            <div className="space-y-2">
              <Label>Kredi Grubu</Label>
              <Input
                placeholder="Örn: Garanti Bankası"
                value={krediGrubuInput}
                onChange={(e) => setKrediGrubuInput(e.target.value)}
                list="kredi-gruplari-list"
              />
              <datalist id="kredi-gruplari-list">
                {krediGruplari.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Mevcut gruplardan seçin veya yeni bir grup yazın
              </p>
            </div>
          )}

          {/* Madde 11: Durum — buton grubu */}
          <div className="space-y-2">
            <Label>Durum *</Label>
            <div className="flex gap-1.5">
              {ODEME_DURUMLARI.map((d) => {
                const isSelected = selectedDurum === d;
                return (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={`h-8 px-4 text-xs ${
                      isSelected
                        ? d === "TAMAMLANDI"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-amber-500 hover:bg-amber-600"
                        : ""
                    }`}
                    onClick={() =>
                      setValue("odeme_durum", d as OdemeCreateData["odeme_durum"], {
                        shouldValidate: true,
                      })
                    }
                  >
                    {d === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
                  </Button>
                );
              })}
            </div>
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
