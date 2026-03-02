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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MONTAJ_SESSION_STATUS, MONTAJ_SESSION_STATUS_LABELS } from "@/lib/constants";
import { montajSessionUpdateSchema, type MontajSessionUpdateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { updateMontajSession } from "../actions";
import { toast } from "sonner";
import type { MontajSession } from "@/lib/supabase/types";

interface MontajEditSheetProps {
  session: MontajSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function MontajEditSheet({ session, open, onOpenChange, onSaved }: MontajEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MontajSessionUpdateData>({
    resolver: zodResolver(montajSessionUpdateSchema),
  });

  useEffect(() => {
    if (session && open) {
      reset({
        sku: session.sku || "",
        step_name: session.step_name || "",
        durum: (session.durum as MontajSessionUpdateData["durum"]) || "montajda",
        operator_id: session.operator_id || "",
        operator_name: session.operator_name || "",
        qty: Number(session.qty) || 0,
        worker_count: session.worker_count || 1,
        notes: session.notes || "",
        start_time: session.start_time ? new Date(session.start_time).toISOString().slice(0, 16) : null,
        end_time: session.end_time ? new Date(session.end_time).toISOString().slice(0, 16) : null,
        is_final_step: session.is_final_step || false,
      });
    }
  }, [session, open, reset]);

  const onSubmit = (data: MontajSessionUpdateData) => {
    if (!session) return;
    startTransition(async () => {
      const result = await updateMontajSession(session.session_id, {
        ...data,
        start_time: data.start_time ? new Date(data.start_time).toISOString() : null,
        end_time: data.end_time ? new Date(data.end_time).toISOString() : null,
      });
      if (result.success) {
        toast.success(`${session.session_id} güncellendi`);
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  const durumValue = watch("durum");
  const isFinalStep = watch("is_final_step");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Montaj Seansı Düzenle</SheetTitle>
          <SheetDescription>{session?.session_id}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input {...register("sku")} />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Adım Adı</Label>
              <Input {...register("step_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                value={durumValue}
                onValueChange={(v) => setValue("durum", v as MontajSessionUpdateData["durum"], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTAJ_SESSION_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {MONTAJ_SESSION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adet</Label>
              <Input type="number" {...register("qty", { valueAsNumber: true })} />
              {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
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
              <Label>Kişi Sayısı</Label>
              <Input type="number" {...register("worker_count", { valueAsNumber: true })} />
              {errors.worker_count && <p className="text-sm text-destructive">{errors.worker_count.message}</p>}
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_final_step"
                  checked={isFinalStep}
                  onCheckedChange={(checked) =>
                    setValue("is_final_step", !!checked, { shouldValidate: true })
                  }
                />
                <Label htmlFor="is_final_step" className="cursor-pointer">
                  Son Adım
                </Label>
              </div>
            </div>
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
            <Label>Notlar</Label>
            <Textarea {...register("notes")} rows={2} />
          </div>

          {session && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Salt Okunur</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Seans ID</span>
                    <p className="font-mono font-medium">{session.session_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adım ID</span>
                    <p className="font-mono font-medium">{session.step_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Birim Montaj (dk)</span>
                    <p className="font-mono font-medium">{session.birim_montaj_dk ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-posta</span>
                    <p className="font-medium">{session.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturma</span>
                    <p className="font-medium">{formatDate(session.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Güncelleme</span>
                    <p className="font-medium">{formatDate(session.updated_at)}</p>
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
