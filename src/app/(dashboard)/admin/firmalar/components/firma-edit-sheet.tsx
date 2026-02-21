"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { sevkiyatFirmaSchema, type SevkiyatFirmaData } from "@/lib/validations";
import { FIRMA_TIPI_LABELS, SEVKIYAT_COUNTRY_CODES, type FirmaTipi } from "@/lib/constants";
import { createFirma, updateFirma } from "../actions";
import type { SevkiyatFirmaRow } from "@/app/(dashboard)/sevkiyat/actions";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface FirmaEditSheetProps {
  firma: SevkiyatFirmaRow | null;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
}

export function FirmaEditSheet({ firma, isNew, open, onClose }: FirmaEditSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SevkiyatFirmaData>({
    resolver: zodResolver(sevkiyatFirmaSchema),
    defaultValues: { aktif: true, varsayilan: false },
  });

  useEffect(() => {
    if (open) {
      if (firma && !isNew) {
        reset({
          firma_tipi: firma.firma_tipi as FirmaTipi,
          country_code: firma.country_code,
          profil_adi: firma.profil_adi,
          firma_adi: firma.firma_adi,
          adres_satir1: firma.adres_satir1,
          adres_satir2: firma.adres_satir2,
          telefon: firma.telefon,
          email: firma.email,
          web: firma.web,
          vergi_no: firma.vergi_no,
          vat_no: firma.vat_no,
          banka_adi: firma.banka_adi,
          sube_adi: firma.sube_adi,
          swift_code: firma.swift_code,
          iban: firma.iban,
          para_birimi: firma.para_birimi,
          sevk_yontemi: firma.sevk_yontemi,
          yetkili_adi: firma.yetkili_adi,
          imza_yeri: firma.imza_yeri,
          aktif: firma.aktif,
          varsayilan: firma.varsayilan,
        });
      } else {
        reset({
          firma_tipi: "ihracatci",
          country_code: null,
          profil_adi: "",
          firma_adi: null,
          adres_satir1: null,
          adres_satir2: null,
          telefon: null,
          email: null,
          web: null,
          vergi_no: null,
          vat_no: null,
          banka_adi: null,
          sube_adi: null,
          swift_code: null,
          iban: null,
          para_birimi: null,
          sevk_yontemi: null,
          yetkili_adi: null,
          imza_yeri: null,
          aktif: true,
          varsayilan: false,
        });
      }
    }
  }, [open, firma, isNew, reset]);

  const firmaTipi = watch("firma_tipi");
  const aktif = watch("aktif");
  const varsayilan = watch("varsayilan");

  const onSubmit = async (data: SevkiyatFirmaData) => {
    setLoading(true);

    // Null dönüştürme
    const payload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      payload[key] = val === "" ? null : val;
    }

    let result;
    if (isNew) {
      result = await createFirma(payload);
    } else if (firma) {
      result = await updateFirma(firma.id, payload);
    } else {
      result = { success: false as const, error: "Hata" };
    }

    if (result.success) {
      toast.success(isNew ? "Firma oluşturuldu" : "Firma güncellendi");
      onClose();
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "Yeni Firma" : "Firma Düzenle"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Tip + Ülke */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Firma Tipi *</Label>
              <Select
                value={firmaTipi}
                onValueChange={(v) => setValue("firma_tipi", v as FirmaTipi)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FIRMA_TIPI_LABELS) as [FirmaTipi, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ülke</Label>
              <Select
                value={watch("country_code") ?? "_global"}
                onValueChange={(v) => setValue("country_code", v === "_global" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_global">Global</SelectItem>
                  {SEVKIYAT_COUNTRY_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Profil adı */}
          <div className="space-y-1.5">
            <Label className="text-xs">Profil Adı *</Label>
            <Input className="h-9" {...register("profil_adi")} />
            {errors.profil_adi && <p className="text-xs text-destructive">{errors.profil_adi.message}</p>}
          </div>

          {/* Firma adı */}
          <div className="space-y-1.5">
            <Label className="text-xs">Firma Adı</Label>
            <Input className="h-9" {...register("firma_adi", { setValueAs: (v: string) => v === "" ? null : v })} />
          </div>

          {/* Adres */}
          <div className="space-y-1.5">
            <Label className="text-xs">Adres Satır 1</Label>
            <Textarea rows={2} className="text-xs" {...register("adres_satir1", { setValueAs: (v: string) => v === "" ? null : v })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Adres Satır 2</Label>
            <Input className="h-9" {...register("adres_satir2", { setValueAs: (v: string) => v === "" ? null : v })} />
          </div>

          {/* İletişim */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefon</Label>
              <Input className="h-9" {...register("telefon", { setValueAs: (v: string) => v === "" ? null : v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-9" {...register("email", { setValueAs: (v: string) => v === "" ? null : v })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Web</Label>
              <Input className="h-9" {...register("web", { setValueAs: (v: string) => v === "" ? null : v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vergi No</Label>
              <Input className="h-9" {...register("vergi_no", { setValueAs: (v: string) => v === "" ? null : v })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">VAT No</Label>
            <Input className="h-9" {...register("vat_no", { setValueAs: (v: string) => v === "" ? null : v })} />
          </div>

          {/* Banka bilgileri */}
          {(firmaTipi === "banka" || firmaTipi === "ihracatci") && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Banka Adı</Label>
                  <Input className="h-9" {...register("banka_adi", { setValueAs: (v: string) => v === "" ? null : v })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Şube Adı</Label>
                  <Input className="h-9" {...register("sube_adi", { setValueAs: (v: string) => v === "" ? null : v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">SWIFT Kodu</Label>
                  <Input className="h-9" {...register("swift_code", { setValueAs: (v: string) => v === "" ? null : v })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Para Birimi</Label>
                  <Input className="h-9" {...register("para_birimi", { setValueAs: (v: string) => v === "" ? null : v })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">IBAN</Label>
                <Input className="h-9" {...register("iban", { setValueAs: (v: string) => v === "" ? null : v })} />
              </div>
            </>
          )}

          {/* İmzalayan */}
          {firmaTipi === "imzalayan" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Yetkili Adı</Label>
                <Input className="h-9" {...register("yetkili_adi", { setValueAs: (v: string) => v === "" ? null : v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">İmza Yeri</Label>
                <Input className="h-9" {...register("imza_yeri", { setValueAs: (v: string) => v === "" ? null : v })} />
              </div>
            </div>
          )}

          {/* Contact */}
          {firmaTipi === "contact" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Yetkili Adı</Label>
              <Input className="h-9" {...register("yetkili_adi", { setValueAs: (v: string) => v === "" ? null : v })} />
            </div>
          )}

          {/* Sevk yöntemi */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sevk Yöntemi</Label>
            <Input className="h-9" placeholder="Road Transport / Sea Freight" {...register("sevk_yontemi", { setValueAs: (v: string) => v === "" ? null : v })} />
          </div>

          {/* Switches */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={aktif}
                onCheckedChange={(v) => setValue("aktif", v)}
              />
              <Label className="text-xs">Aktif</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={varsayilan}
                onCheckedChange={(v) => setValue("varsayilan", v)}
              />
              <Label className="text-xs">Varsayılan</Label>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isNew ? "Oluştur" : "Kaydet"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
