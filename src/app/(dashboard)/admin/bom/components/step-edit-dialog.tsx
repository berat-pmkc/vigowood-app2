"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assemblyStepSchema,
  type AssemblyStepFormData,
} from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface StepEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultValues?: {
    step_name: string;
    seq_no: number;
    is_final_step: boolean;
  };
  nextSeqNo: number;
  onSubmit: (data: AssemblyStepFormData) => Promise<void>;
  loading?: boolean;
}

export function StepEditDialog({
  open,
  onOpenChange,
  mode,
  defaultValues,
  nextSeqNo,
  onSubmit,
  loading,
}: StepEditDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssemblyStepFormData>({
    resolver: zodResolver(assemblyStepSchema),
    defaultValues: defaultValues || {
      step_name: "",
      seq_no: nextSeqNo,
      is_final_step: false,
    },
  });

  const isFinalStep = watch("is_final_step");

  useEffect(() => {
    if (open) {
      if (mode === "create") {
        reset({ step_name: "", seq_no: nextSeqNo, is_final_step: false });
      } else if (defaultValues) {
        reset(defaultValues);
      }
    }
  }, [open, mode, nextSeqNo, defaultValues, reset]);

  async function handleFormSubmit(data: AssemblyStepFormData) {
    await onSubmit(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Yeni Adım Ekle" : "Adımı Düzenle"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="step_name">Adım Adı</Label>
            <Input
              id="step_name"
              placeholder="Örn: Ön Panel Montajı"
              {...register("step_name")}
            />
            {errors.step_name && (
              <p className="text-xs text-destructive">
                {errors.step_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="seq_no">Sıra Numarası</Label>
            <Input
              id="seq_no"
              type="number"
              min={1}
              {...register("seq_no", { valueAsNumber: true })}
            />
            {errors.seq_no && (
              <p className="text-xs text-destructive">
                {errors.seq_no.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_final_step"
              checked={isFinalStep}
              onCheckedChange={(checked) =>
                setValue("is_final_step", checked === true)
              }
            />
            <Label htmlFor="is_final_step" className="cursor-pointer">
              Son Adım (Final Step)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Kaydediliyor..."
                : mode === "create"
                  ? "Oluştur"
                  : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
