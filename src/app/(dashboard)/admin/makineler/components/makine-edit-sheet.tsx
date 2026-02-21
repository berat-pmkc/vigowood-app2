"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Switch } from "@/components/ui/switch";
import { makineCreateSchema, makineUpdateSchema, type MakineCreateData, type MakineUpdateData } from "@/lib/validations";
import { MAKINE_BOLUMLERI, MAKINE_BOLUM_LABELS } from "@/lib/constants";
import { createMakine, updateMakine } from "../actions";

interface Makine {
  makine_id: string;
  tipi: string;
  bolum: string;
  aciklama: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

interface MakineEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  makine?: Makine | null;
}

export function MakineEditSheet({ open, onOpenChange, makine }: MakineEditSheetProps) {
  const isEdit = !!makine;
  const [loading, setLoading] = useState(false);

  const form = useForm<MakineCreateData>({
    resolver: zodResolver(isEdit ? makineUpdateSchema : makineCreateSchema),
    defaultValues: {
      makine_id: makine?.makine_id ?? "",
      tipi: makine?.tipi ?? "",
      bolum: (makine?.bolum as MakineCreateData["bolum"]) ?? "Kesim",
      aciklama: makine?.aciklama ?? null,
    },
  });

  // Reset form when sheet opens with new data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      form.reset({
        makine_id: makine?.makine_id ?? "",
        tipi: makine?.tipi ?? "",
        bolum: (makine?.bolum as MakineCreateData["bolum"]) ?? "Kesim",
        aciklama: makine?.aciklama ?? null,
      });
    }
    onOpenChange(isOpen);
  };

  const onSubmit = async (data: MakineCreateData) => {
    setLoading(true);
    try {
      if (isEdit) {
        const updateData: MakineUpdateData = {
          tipi: data.tipi,
          bolum: data.bolum,
          aciklama: data.aciklama,
          aktif: makine?.aktif ?? true,
        };
        const result = await updateMakine(makine.makine_id, updateData);
        if (result.success) {
          toast.success("Makine güncellendi");
          handleOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createMakine(data);
        if (result.success) {
          toast.success("Makine oluşturuldu");
          handleOpenChange(false);
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Makine Düzenle" : "Yeni Makine"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `${makine.makine_id} makinesini düzenle`
              : "Yeni bir makine ekle"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Makine ID — sadece create'te */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="makine_id">Makine ID</Label>
              <Input
                id="makine_id"
                placeholder="ör: BÜYÜK, LAZER-3"
                {...form.register("makine_id")}
              />
              {form.formState.errors.makine_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.makine_id.message}
                </p>
              )}
            </div>
          )}

          {/* Tipi */}
          <div className="space-y-2">
            <Label htmlFor="tipi">Makine Tipi</Label>
            <Input
              id="tipi"
              placeholder="ör: 600W Lazer, BALA"
              {...form.register("tipi")}
            />
            {form.formState.errors.tipi && (
              <p className="text-sm text-destructive">
                {form.formState.errors.tipi.message}
              </p>
            )}
          </div>

          {/* Bölüm */}
          <div className="space-y-2">
            <Label>Bölüm</Label>
            <Select
              value={form.watch("bolum")}
              onValueChange={(val) => form.setValue("bolum", val as MakineCreateData["bolum"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bölüm seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {MAKINE_BOLUMLERI.map((b) => (
                  <SelectItem key={b} value={b}>
                    {MAKINE_BOLUM_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.bolum && (
              <p className="text-sm text-destructive">
                {form.formState.errors.bolum.message}
              </p>
            )}
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label htmlFor="aciklama">Açıklama</Label>
            <Input
              id="aciklama"
              placeholder="Makine açıklaması (isteğe bağlı)"
              {...form.register("aciklama", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
