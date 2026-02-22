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
import { nakitGirisTakipSchema, type NakitGirisTakipData } from "@/lib/validations";
import { PARA_BIRIMLERI, ODEME_DURUMLARI } from "@/lib/constants";
import { createGirisTakip, updateGirisTakip } from "../actions";

interface GirisTakipRow {
  id: string;
  tanimi: string;
  tutar: number;
  cinsi: string | null;
  tarih: string | null;
  turu: string | null;
  marka: string | null;
  odeme_durum: string | null;
}

interface NakitGirisTakipFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: GirisTakipRow | null;
}

const MARKA_OPTIONS = ["VİGOWOOD", "HASMOB"] as const;
const TURU_OPTIONS = ["AMAZON", "NAKİT", "KART", "HAVALE", "DİĞER"] as const;

export function NakitGirisTakipFormSheet({
  open,
  onOpenChange,
  editingRecord,
}: NakitGirisTakipFormSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!editingRecord;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<NakitGirisTakipData>({
    resolver: zodResolver(nakitGirisTakipSchema),
    defaultValues: {
      tanimi: "",
      tutar: 0,
      cinsi: "TL",
      tarih: null,
      turu: null,
      marka: null,
      odeme_durum: "BEKLİYOR",
    },
  });

  const selectedCinsi = watch("cinsi");
  const selectedDurum = watch("odeme_durum");
  const selectedTuru = watch("turu");
  const selectedMarka = watch("marka");

  useEffect(() => {
    if (open) {
      if (editingRecord) {
        reset({
          tanimi: editingRecord.tanimi,
          tutar: Number(editingRecord.tutar),
          cinsi: (editingRecord.cinsi as NakitGirisTakipData["cinsi"]) || "TL",
          tarih: editingRecord.tarih || null,
          turu: editingRecord.turu || null,
          marka: editingRecord.marka || null,
          odeme_durum: (editingRecord.odeme_durum as NakitGirisTakipData["odeme_durum"]) || "BEKLİYOR",
        });
      } else {
        reset({
          tanimi: "",
          tutar: 0,
          cinsi: "TL",
          tarih: null,
          turu: null,
          marka: null,
          odeme_durum: "BEKLİYOR",
        });
      }
    }
  }, [open, editingRecord, reset]);

  const onSubmit = (data: NakitGirisTakipData) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateGirisTakip(editingRecord!.id, data)
        : await createGirisTakip(data);

      if (result.success) {
        toast.success(isEdit ? "Kayıt güncellendi" : "Alacak kaydı oluşturuldu");
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
          <SheetTitle>{isEdit ? "Alacak Düzenle" : "Yeni Alacak"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Tanım */}
          <div className="space-y-2">
            <Label htmlFor="tanimi">Tanım *</Label>
            <Input id="tanimi" placeholder="Alacak tanımı..." {...register("tanimi")} />
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
                  setValue("cinsi", v as NakitGirisTakipData["cinsi"], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARA_BIRIMLERI.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tarih */}
          <div className="space-y-2">
            <Label htmlFor="tarih">Beklenen Tarih</Label>
            <Input
              id="tarih"
              type="date"
              {...register("tarih", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
            />
          </div>

          {/* Tür */}
          <div className="space-y-2">
            <Label>Tür</Label>
            <Select
              value={selectedTuru || "none"}
              onValueChange={(v) =>
                setValue("turu", v === "none" ? null : v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seçiniz</SelectItem>
                {TURU_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Marka */}
          <div className="space-y-2">
            <Label>Marka</Label>
            <Select
              value={selectedMarka || "none"}
              onValueChange={(v) =>
                setValue("marka", v === "none" ? null : v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seçiniz</SelectItem>
                {MARKA_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Durum */}
          <div className="space-y-2">
            <Label>Durum *</Label>
            <Select
              value={selectedDurum}
              onValueChange={(v) =>
                setValue("odeme_durum", v as NakitGirisTakipData["odeme_durum"], {
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
