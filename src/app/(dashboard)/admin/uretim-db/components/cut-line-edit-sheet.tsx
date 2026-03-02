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
import { Separator } from "@/components/ui/separator";
import { cutLineUpdateSchema, type CutLineUpdateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { updateCutLine } from "../actions";
import { toast } from "sonner";
import type { CutLine } from "@/lib/supabase/types";

interface CutLineEditSheetProps {
  line: CutLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CutLineEditSheet({ line, open, onOpenChange, onSaved }: CutLineEditSheetProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CutLineUpdateData>({
    resolver: zodResolver(cutLineUpdateSchema),
  });

  useEffect(() => {
    if (line && open) {
      reset({
        part_id: line.part_id || "",
        adet: Number(line.adet) || 0,
        not_text: line.not_text || "",
        renk: line.renk || "",
      });
    }
  }, [line, open, reset]);

  const onSubmit = (data: CutLineUpdateData) => {
    if (!line) return;
    startTransition(async () => {
      const result = await updateCutLine(line.cut_line_id, data);
      if (result.success) {
        toast.success(`${line.cut_line_id} güncellendi`);
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Kesim Satırı Düzenle</SheetTitle>
          <SheetDescription>{line?.cut_line_id}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Parça ID</Label>
            <Input {...register("part_id")} placeholder="Parça ID" />
          </div>
          <div className="space-y-2">
            <Label>Adet</Label>
            <Input type="number" {...register("adet", { valueAsNumber: true })} />
            {errors.adet && <p className="text-sm text-destructive">{errors.adet.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Renk</Label>
            <Input {...register("renk")} />
          </div>
          <div className="space-y-2">
            <Label>Not</Label>
            <Input {...register("not_text")} />
          </div>

          {line && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Salt Okunur</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Satır ID</span>
                    <p className="font-mono font-medium">{line.cut_line_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kesim ID</span>
                    <p className="font-mono font-medium">{line.cut_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tarih</span>
                    <p className="font-medium">{formatDate(line.tarih)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-posta</span>
                    <p className="font-medium">{line.email || "—"}</p>
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
