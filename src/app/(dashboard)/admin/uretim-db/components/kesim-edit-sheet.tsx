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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CUT_STATUS, CUT_STATUS_LABELS } from "@/lib/constants";
import { cutBatchUpdateSchema, type CutBatchUpdateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { updateCutBatch } from "../actions";
import { toast } from "sonner";
import type { CutBatch } from "@/lib/supabase/types";

const MAKINE_OPTIONS = ["MAK-1", "MAK-2", "MAK-3", "KUTU"];

interface KesimEditSheetProps {
  batch: CutBatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function KesimEditSheet({ batch, open, onOpenChange, onSaved }: KesimEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CutBatchUpdateData>({
    resolver: zodResolver(cutBatchUpdateSchema),
  });

  useEffect(() => {
    if (batch && open) {
      reset({
        sku: batch.sku || "",
        plaka_id: batch.plaka_id || "",
        makine_id: batch.makine_id || "",
        adet: Number(batch.adet) || 0,
        operator_id: batch.operator_id || "",
        durum: (batch.durum as CutBatchUpdateData["durum"]) || "bekliyor",
        plk_notu: batch.plk_notu || "",
        tarih: batch.tarih ? new Date(batch.tarih).toISOString().slice(0, 16) : "",
        baslama_zamani: batch.baslama_zamani ? new Date(batch.baslama_zamani).toISOString().slice(0, 16) : null,
        bitis_zamani: batch.bitis_zamani ? new Date(batch.bitis_zamani).toISOString().slice(0, 16) : null,
      });
    }
  }, [batch, open, reset]);

  const onSubmit = (data: CutBatchUpdateData) => {
    if (!batch) return;
    startTransition(async () => {
      const result = await updateCutBatch(batch.cut_id, {
        ...data,
        tarih: data.tarih ? new Date(data.tarih).toISOString() : batch.tarih,
        baslama_zamani: data.baslama_zamani ? new Date(data.baslama_zamani).toISOString() : null,
        bitis_zamani: data.bitis_zamani ? new Date(data.bitis_zamani).toISOString() : null,
      });
      if (result.success) {
        toast.success(`${batch.cut_id} güncellendi`);
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const durumValue = watch("durum");
  const makineValue = watch("makine_id");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Kesim Kaydı Düzenle</SheetTitle>
          <SheetDescription>{batch?.cut_id}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input {...register("sku")} />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Plaka ID</Label>
              <Input {...register("plaka_id")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Makine</Label>
              <Select
                value={makineValue || ""}
                onValueChange={(v) => setValue("makine_id", v || null, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Makine seç" />
                </SelectTrigger>
                <SelectContent>
                  {MAKINE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adet</Label>
              <Input type="number" {...register("adet", { valueAsNumber: true })} />
              {errors.adet && <p className="text-sm text-destructive">{errors.adet.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operatör ID</Label>
              <Input {...register("operator_id")} placeholder="VW001" />
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                value={durumValue}
                onValueChange={(v) => setValue("durum", v as CutBatchUpdateData["durum"], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CUT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tarih</Label>
            <Input type="datetime-local" {...register("tarih")} />
            {errors.tarih && <p className="text-sm text-destructive">{errors.tarih.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlama Zamanı</Label>
              <Input type="datetime-local" {...register("baslama_zamani")} />
            </div>
            <div className="space-y-2">
              <Label>Bitiş Zamanı</Label>
              <Input type="datetime-local" {...register("bitis_zamani")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Not</Label>
            <Textarea {...register("plk_notu")} rows={2} />
          </div>

          {batch && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Salt Okunur</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Kesim ID</span>
                    <p className="font-mono font-medium">{batch.cut_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-posta</span>
                    <p className="font-medium">{batch.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturma</span>
                    <p className="font-medium">{formatDate(batch.created_at)}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
