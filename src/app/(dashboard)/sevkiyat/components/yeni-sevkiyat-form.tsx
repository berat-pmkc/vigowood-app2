"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sevkiyatCreateSchema, type SevkiyatCreateData } from "@/lib/validations";
import {
  KONTEYNER_TYPES,
  KONTEYNER_TYPE_LABELS,
  SEVKIYAT_COUNTRIES,
  type SevkiyatCountryCode,
} from "@/lib/constants";
import { createSevkiyat } from "../actions";
import { ArrowLeft, Truck, MapPin, Building2, Banknote } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function YeniSevkiyatForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SevkiyatCreateData>({
    resolver: zodResolver(sevkiyatCreateSchema),
    defaultValues: {
      country_code: "DE",
      sevk_tarihi: null,
      konteyner_no: null,
      konteyner_tipi: null,
      not_text: null,
    },
  });

  const countryCode = watch("country_code") as SevkiyatCountryCode | undefined;
  const konteynerTipi = watch("konteyner_tipi");
  const selectedCountry = countryCode ? SEVKIYAT_COUNTRIES[countryCode] : null;

  const onSubmit = async (data: SevkiyatCreateData) => {
    setLoading(true);
    const result = await createSevkiyat({
      country_code: data.country_code,
      sevk_tarihi: data.sevk_tarihi || null,
      konteyner_no: data.konteyner_no || null,
      konteyner_tipi: data.konteyner_tipi || null,
      not_text: data.not_text || null,
    });

    if (result.success) {
      toast.success("Sevkiyat olu\u015fturuldu");
      router.push("/sevkiyat");
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sevkiyat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Yeni Sevkiyat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            \u00dclke se\u00e7in, sevkiyat bilgilerini girin
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">\u00dclke ve Sevkiyat Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* \u00dclke Se\u00e7imi */}
            <div className="space-y-2">
              <Label>\u00dclke *</Label>
              <Select
                value={countryCode ?? "DE"}
                onValueChange={(v) => setValue("country_code", v as SevkiyatCreateData["country_code"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="\u00dclke se\u00e7in" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SEVKIYAT_COUNTRIES).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.currencySymbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country_code && (
                <p className="text-sm text-destructive">{errors.country_code.message}</p>
              )}
            </div>

            {/* Otomatik doldurulan bilgiler */}
            {selectedCountry && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Otomatik Doldurulacak</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedCountry.buyer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>Liman: {selectedCountry.port}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>Para birimi: {selectedCountry.currency} ({selectedCountry.currencySymbol})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sevk Tarihi */}
            <div className="space-y-2">
              <Label htmlFor="sevk_tarihi">Sevk Tarihi</Label>
              <Input
                id="sevk_tarihi"
                type="date"
                {...register("sevk_tarihi", { setValueAs: (v: string) => v === "" ? null : v })}
              />
            </div>

            {/* Konteyner No */}
            <div className="space-y-2">
              <Label htmlFor="konteyner_no">Konteyner No</Label>
              <Input
                id="konteyner_no"
                placeholder="ABCD1234567"
                {...register("konteyner_no", { setValueAs: (v: string) => v === "" ? null : v })}
              />
            </div>

            {/* Konteyner Tipi */}
            <div className="space-y-2">
              <Label>Konteyner Tipi</Label>
              <Select
                value={konteynerTipi ?? ""}
                onValueChange={(v) => setValue("konteyner_tipi", v === "" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Konteyner tipi se\u00e7in" />
                </SelectTrigger>
                <SelectContent>
                  {KONTEYNER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {KONTEYNER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Not */}
            <div className="space-y-2">
              <Label htmlFor="not_text">Not</Label>
              <Textarea
                id="not_text"
                placeholder="Ek bilgi veya not..."
                rows={3}
                {...register("not_text", { setValueAs: (v: string) => v === "" ? null : v })}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 h-12"
                disabled={loading}
              >
                <Truck className="w-5 h-5 mr-2" />
                {loading ? "Olu\u015fturuluyor..." : "Sevkiyat Olu\u015ftur"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => router.push("/sevkiyat")}
              >
                \u0130ptal
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
