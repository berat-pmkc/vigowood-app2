"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SevkiyatStatusBadge } from "../../components/sevkiyat-status-badge";
import {
  KONTEYNER_TYPE_LABELS,
  type KonteynerType,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { updateGerceklesenTarih } from "../../actions";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  CalendarCheck,
  Container,
  User,
  Truck,
  Building2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { SevkiyatRow } from "../../actions";

interface ShipmentHeaderProps {
  sevkiyat: SevkiyatRow;
}

export function ShipmentHeader({ sevkiyat }: ShipmentHeaderProps) {
  const router = useRouter();
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(sevkiyat.gerceklesen_sevk_tarihi ?? "");

  const isTir = sevkiyat.arac_tipi === "tir";

  const handleSaveDate = async () => {
    if (!dateValue) return;
    const result = await updateGerceklesenTarih(sevkiyat.sevkiyat_id, dateValue);
    if (result.success) {
      toast.success("Tarih güncellendi");
      setEditingDate(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Hata oluştu");
    }
  };

  // Araç/plaka bilgisi
  const aracLabel = isTir ? "Tır Plaka" : "Konteyner";
  const aracValue = isTir
    ? (sevkiyat.tir_plaka ?? "—")
    : (sevkiyat.konteyner_no ?? "—");

  // Dorse plaka (sadece tır)
  const dorsePlaka = isTir ? sevkiyat.dorse_plaka : null;

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/sevkiyat")}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Sevkiyatlar</span>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-sm">
              {sevkiyat.sevkiyat_id}
            </Badge>
            {sevkiyat.country_code && (
              <Badge variant="outline" className="font-semibold">
                {sevkiyat.country_code}
              </Badge>
            )}
            <span className="text-lg font-semibold text-foreground hidden sm:inline">
              {sevkiyat.sevkiyat_adi}
            </span>
          </div>
        </div>
        <SevkiyatStatusBadge durum={sevkiyat.durum} />
      </div>

      {/* Info card */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Müşteri</p>
              <p className="font-medium truncate">{sevkiyat.musteri}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Liman</p>
              <p className="font-medium">{sevkiyat.liman ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Planlanan Tarih</p>
              <p className="font-medium">
                {sevkiyat.planlanan_sevk_tarihi
                  ? formatDate(sevkiyat.planlanan_sevk_tarihi)
                  : sevkiyat.sevk_tarihi
                    ? formatDate(sevkiyat.sevk_tarihi)
                    : "—"}
              </p>
            </div>
          </div>

          {/* Gerçekleşen tarih — düzenlenebilir */}
          <div className="flex items-start gap-2">
            <CalendarCheck className={`w-4 h-4 mt-0.5 shrink-0 ${sevkiyat.gerceklesen_sevk_tarihi ? "text-emerald-600" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Gerçekleşen</p>
              {editingDate ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Input
                    type="date"
                    className="h-7 text-xs w-[130px]"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveDate}>
                    <Check className="w-3 h-3 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingDate(false)}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <p className={`font-medium ${sevkiyat.gerceklesen_sevk_tarihi ? "text-emerald-700" : ""}`}>
                    {sevkiyat.gerceklesen_sevk_tarihi
                      ? formatDate(sevkiyat.gerceklesen_sevk_tarihi)
                      : "—"}
                  </p>
                  {sevkiyat.gerceklesen_sevk_tarihi && (
                    <button
                      onClick={() => setEditingDate(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Araç bilgisi */}
          <div className="flex items-start gap-2">
            {isTir ? (
              <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            ) : (
              <Container className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-xs text-muted-foreground">{aracLabel}</p>
              <p className="font-medium">{aracValue}</p>
              {dorsePlaka && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dorse: <span className="font-medium text-foreground">{dorsePlaka}</span>
                </p>
              )}
              {!isTir && sevkiyat.konteyner_tipi && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {KONTEYNER_TYPE_LABELS[sevkiyat.konteyner_tipi as KonteynerType] ?? sevkiyat.konteyner_tipi}
                </p>
              )}
            </div>
          </div>

          {/* Taşıyıcı / Teslimat */}
          <div className="flex items-start gap-2">
            {sevkiyat.tasiyici_firma ? (
              <>
                <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Taşıyıcı</p>
                  <p className="font-medium truncate">{sevkiyat.tasiyici_firma}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sevkiyat.teslimat_tipi ?? "DAP"}</p>
                </div>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Teslimat</p>
                  <p className="font-medium">{sevkiyat.teslimat_tipi ?? "DAP"}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
