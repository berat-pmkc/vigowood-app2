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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { kampanyaSchema, type KampanyaData } from "@/lib/validations";
import { createKampanya, updateKampanya } from "../actions";
import type { KampanyaRow } from "./kampanyalar-client";

interface KampanyaEditSheetProps {
  open: boolean;
  onClose: () => void;
  row: KampanyaRow | null;
}

export function KampanyaEditSheet({ open, onClose, row }: KampanyaEditSheetProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!row;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KampanyaData>({
    resolver: zodResolver(kampanyaSchema),
    defaultValues: {
      kampanya_adi: "",
      baslangic_tarihi: "",
      bitis_tarihi: "",
      ana_hedef: null,
      ziyaretci: null,
      siparis_sayisi: null,
      ciro: null,
      donusum_orani: null,
      ortalama_sepet: null,
      notlar: null,
    },
  });

  useEffect(() => {
    if (row) {
      reset({
        kampanya_adi: row.kampanya_adi,
        baslangic_tarihi: row.baslangic_tarihi,
        bitis_tarihi: row.bitis_tarihi,
        ana_hedef: row.ana_hedef,
        ziyaretci: row.ziyaretci,
        siparis_sayisi: row.siparis_sayisi,
        ciro: row.ciro,
        donusum_orani: row.donusum_orani,
        ortalama_sepet: row.ortalama_sepet,
        notlar: row.notlar,
      });
    } else {
      reset({
        kampanya_adi: "",
        baslangic_tarihi: new Date().toISOString().split("T")[0],
        bitis_tarihi: "",
        ana_hedef: null,
        ziyaretci: null,
        siparis_sayisi: null,
        ciro: null,
        donusum_orani: null,
        ortalama_sepet: null,
        notlar: null,
      });
    }
  }, [row, reset]);

  async function onSubmit(data: KampanyaData) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateKampanya(row!.id, data)
        : await createKampanya(data);
      if (result.success) {
        toast.success(isEdit ? "Kampanya güncellendi" : "Kampanya oluşturuldu");
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Kampanyayı Düzenle" : "Yeni Kampanya"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Kampanya bilgilerini güncelleyin" : "Yeni kampanya ekleyin"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Kampanya Adı</Label>
            <Input {...register("kampanya_adi")} placeholder="Örn: Yaz İndirimi 2026" />
            {errors.kampanya_adi && <p className="text-xs text-destructive">{errors.kampanya_adi.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Başlangıç Tarihi</Label>
              <Input type="date" {...register("baslangic_tarihi")} />
              {errors.baslangic_tarihi && <p className="text-xs text-destructive">{errors.baslangic_tarihi.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş Tarihi</Label>
              <Input type="date" {...register("bitis_tarihi")} />
              {errors.bitis_tarihi && <p className="text-xs text-destructive">{errors.bitis_tarihi.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ana Hedef</Label>
            <Input
              {...register("ana_hedef", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
              placeholder="Kampanyanın ana hedefi..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ziyaretçi</Label>
              <Input
                type="number"
                {...register("ziyaretci", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sipariş Sayısı</Label>
              <Input
                type="number"
                {...register("siparis_sayisi", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ciro (₺)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("ciro", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dönüşüm Oranı (%)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("donusum_orani", {
                  setValueAs: (v: string) => (v === "" ? null : Number(v)),
                })}
              />
            </div>
          </div>

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
            <Label>Notlar</Label>
            <Textarea
              {...register("notlar", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
              placeholder="Kampanya notları..."
              rows={3}
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
