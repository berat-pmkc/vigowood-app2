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
import { PACK_STATUS, PACK_STATUS_LABELS } from "@/lib/constants";
import { packEventUpdateSchema, type PackEventUpdateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { updatePackEvent } from "../actions";
import { toast } from "sonner";
import type { PackEvent } from "@/lib/supabase/types";

interface PaketlemeEditSheetProps {
  event: PackEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PaketlemeEditSheet({ event, open, onOpenChange, onSaved }: PaketlemeEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PackEventUpdateData>({
    resolver: zodResolver(packEventUpdateSchema),
  });

  useEffect(() => {
    if (event && open) {
      reset({
        sku: event.sku || "",
        durum: (event.durum as PackEventUpdateData["durum"]) || "bekliyor",
        operator_id: event.operator_id || "",
        operator_name: event.operator_name || "",
        qty: Number(event.qty) || 0,
        worker_count: event.worker_count || 1,
        not_text: event.not_text || "",
        tarih: event.tarih ? new Date(event.tarih).toISOString().slice(0, 16) : null,
        start_time: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : null,
        end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : null,
      });
    }
  }, [event, open, reset]);

  const onSubmit = (data: PackEventUpdateData) => {
    if (!event) return;
    startTransition(async () => {
      const result = await updatePackEvent(event.session_id, {
        ...data,
        tarih: data.tarih ? new Date(data.tarih).toISOString() : null,
        start_time: data.start_time ? new Date(data.start_time).toISOString() : null,
        end_time: data.end_time ? new Date(data.end_time).toISOString() : null,
      });
      if (result.success) {
        toast.success(`${event.session_id} güncellendi`);
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const durumValue = watch("durum");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Paketleme Seansı Düzenle</SheetTitle>
          <SheetDescription>{event?.session_id}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input {...register("sku")} />
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                value={durumValue}
                onValueChange={(v) => setValue("durum", v as PackEventUpdateData["durum"], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACK_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PACK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operatör ID</Label>
              <Input {...register("operator_id")} placeholder="VW001" />
            </div>
            <div className="space-y-2">
              <Label>Operatör Adı</Label>
              <Input {...register("operator_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adet</Label>
              <Input type="number" {...register("qty", { valueAsNumber: true })} />
              {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Kişi Sayısı</Label>
              <Input type="number" {...register("worker_count", { valueAsNumber: true })} />
              {errors.worker_count && <p className="text-sm text-destructive">{errors.worker_count.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tarih</Label>
            <Input type="datetime-local" {...register("tarih")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlama Zamanı</Label>
              <Input type="datetime-local" {...register("start_time")} />
            </div>
            <div className="space-y-2">
              <Label>Bitiş Zamanı</Label>
              <Input type="datetime-local" {...register("end_time")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Not</Label>
            <Textarea {...register("not_text")} rows={2} />
          </div>

          {event && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Salt Okunur</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Seans ID</span>
                    <p className="font-mono font-medium">{event.session_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Birim Paketleme (dk)</span>
                    <p className="font-mono font-medium">{event.birim_paketleme_dk ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-posta</span>
                    <p className="font-medium">{event.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturma</span>
                    <p className="font-medium">{formatDate(event.created_at)}</p>
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
