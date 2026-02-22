"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
import { trPazarlamaSchema, type TrPazarlamaData } from "@/lib/validations";
import { createPazarlama, updatePazarlama } from "../actions";
import type { PazarlamaRow } from "./pazarlama-client";

interface PazarlamaEditSheetProps {
  open: boolean;
  onClose: () => void;
  row: PazarlamaRow | null;
  pazaryeriSecenekleri: string[];
}

const AY_OPTIONS = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

export function PazarlamaEditSheet({ open, onClose, row, pazaryeriSecenekleri }: PazarlamaEditSheetProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!row;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TrPazarlamaData>({
    resolver: zodResolver(trPazarlamaSchema),
    defaultValues: {
      yil: new Date().getFullYear(),
      ay: new Date().getMonth() + 1,
      pazaryeri: "",
      hedef_ciro: 0,
      gercek_ciro: 0,
      siparis_sayisi: 0,
      ziyaretci: 0,
      donusum_orani: 0,
      iadeler: 0,
      ortalama_sepet: null,
      reklam_harcamasi: null,
      not_text: null,
    },
  });

  useEffect(() => {
    if (row) {
      reset({
        yil: row.yil,
        ay: row.ay,
        pazaryeri: row.pazaryeri,
        hedef_ciro: row.hedef_ciro,
        gercek_ciro: row.gercek_ciro,
        siparis_sayisi: row.siparis_sayisi,
        ziyaretci: row.ziyaretci,
        donusum_orani: row.donusum_orani,
        iadeler: row.iadeler,
        ortalama_sepet: row.ortalama_sepet,
        reklam_harcamasi: row.reklam_harcamasi,
        not_text: row.not_text,
      });
    } else {
      reset({
        yil: new Date().getFullYear(),
        ay: new Date().getMonth() + 1,
        pazaryeri: "",
        hedef_ciro: 0,
        gercek_ciro: 0,
        siparis_sayisi: 0,
        ziyaretci: 0,
        donusum_orani: 0,
        iadeler: 0,
        ortalama_sepet: null,
        reklam_harcamasi: null,
        not_text: null,
      });
    }
  }, [row, reset]);

  async function onSubmit(data: TrPazarlamaData) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updatePazarlama(row!.id, data)
        : await createPazarlama(data);
      if (result.success) {
        toast.success(isEdit ? "Kayıt güncellendi" : "Kayıt eklendi");
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  const watchedAy = watch("ay");
  const watchedPazaryeri = watch("pazaryeri");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Kayıt Düzenle" : "Yeni Kayıt"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Pazarlama verisini güncelleyin" : "Yeni aylık pazarlama verisi ekleyin"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Yıl</Label>
              <Input type="number" {...register("yil", { valueAsNumber: true })} />
              {errors.yil && <p className="text-xs text-destructive">{errors.yil.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Ay</Label>
              <Select
                value={String(watchedAy)}
                onValueChange={(v) => setValue("ay", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AY_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={String(a.value)}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ay && <p className="text-xs text-destructive">{errors.ay.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pazaryeri</Label>
            <Select
              value={watchedPazaryeri}
              onValueChange={(v) => setValue("pazaryeri", v)}
            >
              <SelectTrigger><SelectValue placeholder="Pazaryeri seçin" /></SelectTrigger>
              <SelectContent>
                {pazaryeriSecenekleri.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.pazaryeri && <p className="text-xs text-destructive">{errors.pazaryeri.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hedef Ciro (₺)</Label>
              <Input type="number" step="0.01" {...register("hedef_ciro", { valueAsNumber: true })} />
              {errors.hedef_ciro && <p className="text-xs text-destructive">{errors.hedef_ciro.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gerçek Ciro (₺)</Label>
              <Input type="number" step="0.01" {...register("gercek_ciro", { valueAsNumber: true })} />
              {errors.gercek_ciro && <p className="text-xs text-destructive">{errors.gercek_ciro.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sipariş Sayısı</Label>
              <Input type="number" {...register("siparis_sayisi", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ziyaretçi</Label>
              <Input type="number" {...register("ziyaretci", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dönüşüm Oranı (%)</Label>
              <Input type="number" step="0.01" {...register("donusum_orani", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>İadeler</Label>
              <Input type="number" {...register("iadeler", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ortalama Sepet (₺)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("ortalama_sepet", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reklam Harcaması (₺)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("reklam_harcamasi", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Not</Label>
            <Input
              {...register("not_text", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
              placeholder="Opsiyonel not..."
            />
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Güncelle" : "Kaydet"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
