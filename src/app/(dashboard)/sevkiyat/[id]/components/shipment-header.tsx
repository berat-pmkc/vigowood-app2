"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SevkiyatStatusBadge } from "../../components/sevkiyat-status-badge";
import {
  KONTEYNER_TYPE_LABELS,
  type KonteynerType,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  CalendarCheck,
  Container,
  User,
  Truck,
} from "lucide-react";
import type { SevkiyatRow } from "../../actions";

interface ShipmentHeaderProps {
  sevkiyat: SevkiyatRow;
}

export function ShipmentHeader({ sevkiyat }: ShipmentHeaderProps) {
  const router = useRouter();

  const isTir = sevkiyat.arac_tipi === "tir";

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

          {sevkiyat.gerceklesen_sevk_tarihi ? (
            <div className="flex items-start gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Gerçekleşen</p>
                <p className="font-medium text-emerald-700">
                  {formatDate(sevkiyat.gerceklesen_sevk_tarihi)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {isTir ? (
                <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              ) : (
                <Container className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">
                  {isTir ? "Tır Plaka" : "Konteyner"}
                </p>
                <p className="font-medium">
                  {isTir
                    ? (sevkiyat.tir_plaka ?? "—")
                    : (sevkiyat.konteyner_no ?? "—")}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            {isTir ? (
              <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            ) : (
              <Container className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-xs text-muted-foreground">
                {isTir ? "Araç" : "Tip"}
              </p>
              <p className="font-medium">
                {isTir
                  ? "Tır"
                  : sevkiyat.konteyner_tipi
                    ? (KONTEYNER_TYPE_LABELS[sevkiyat.konteyner_tipi as KonteynerType] ??
                        sevkiyat.konteyner_tipi)
                    : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Teslimat</p>
              <p className="font-medium">
                {sevkiyat.teslimat_tipi ?? "DAP"}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
