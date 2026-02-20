"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SevkiyatStatusBadge } from "./sevkiyat-status-badge";
import { SevkiyatDetailSheet } from "./sevkiyat-detail-sheet";
import { startPreparation } from "../actions";
import {
  SEVKIYAT_STATUS_BORDER_COLORS,
  KONTEYNER_TYPE_LABELS,
  SEVKIYAT_COUNTRIES,
  type SevkiyatStatus,
  type KonteynerType,
  type SevkiyatCountryCode,
} from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import {
  PackageCheck,
  CheckCircle,
  MapPin,
  Calendar,
  Container,
  Package,
  Weight,
  Box,
} from "lucide-react";
import { toast } from "sonner";

export interface SevkiyatRow {
  sevkiyat_id: string;
  musteri: string;
  ulke: string | null;
  sevk_tarihi: string | null;
  konteyner_no: string | null;
  konteyner_tipi: string | null;
  durum: string;
  not_text: string | null;
  operator_id: string | null;
  operator_name: string | null;
  email: string | null;
  hazirlama_zamani: string | null;
  gonderim_zamani: string | null;
  teslim_zamani: string | null;
  country_code: string | null;
  shipment_number: number | null;
  sevkiyat_adi: string | null;
  liman: string | null;
  teslimat_tipi: string | null;
  created_at: string;
  updated_at: string;
  // Enriched
  item_count?: number;
  total_qty?: number;
  total_palet?: number;
  total_koli?: number;
  total_agirlik?: number;
  total_hacim?: number;
  total_fiyat?: number;
}

interface SevkiyatCardProps {
  sevkiyat: SevkiyatRow;
}

export function SevkiyatCard({ sevkiyat }: SevkiyatCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const durum = sevkiyat.durum as SevkiyatStatus;
  const borderColor = SEVKIYAT_STATUS_BORDER_COLORS[durum] ?? SEVKIYAT_STATUS_BORDER_COLORS.bekliyor;
  const isTeslim = durum === "teslim_edildi";
  const country = sevkiyat.country_code
    ? SEVKIYAT_COUNTRIES[sevkiyat.country_code as SevkiyatCountryCode]
    : null;
  const currencySymbol = country?.currencySymbol ?? "$";

  const handleStartPrep = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startPreparation(sevkiyat.sevkiyat_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Haz\u0131rl\u0131k ba\u015flat\u0131ld\u0131");
    setLoading(false);
  };

  return (
    <>
      <Card
        className={cn(
          "border-l-4 cursor-pointer transition-all hover:shadow-md",
          borderColor,
          isTeslim && "opacity-70"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {sevkiyat.sevkiyat_id}
              </Badge>
              {sevkiyat.country_code && (
                <Badge variant="outline" className="text-xs font-semibold">
                  {sevkiyat.country_code}
                </Badge>
              )}
            </div>
            <SevkiyatStatusBadge durum={sevkiyat.durum} />
          </div>

          {/* Body */}
          <div className="mb-3">
            <p className="font-medium text-foreground truncate">
              {sevkiyat.sevkiyat_adi || sevkiyat.musteri}
            </p>
            {sevkiyat.liman && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {sevkiyat.liman}
              </p>
            )}
          </div>

          {/* Konteyner + Lojistik */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {sevkiyat.konteyner_tipi && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Container className="w-3 h-3" />
                  {KONTEYNER_TYPE_LABELS[sevkiyat.konteyner_tipi as KonteynerType] ?? sevkiyat.konteyner_tipi}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {(sevkiyat.total_palet ?? 0) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Box className="w-3 h-3" />
                  <span className="font-semibold tabular-nums text-foreground">{sevkiyat.total_palet}</span> plt
                </span>
              )}
              {(sevkiyat.total_koli ?? 0) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Package className="w-3 h-3" />
                  <span className="font-semibold tabular-nums text-foreground">{sevkiyat.total_koli}</span> koli
                </span>
              )}
              {(sevkiyat.total_agirlik ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 hidden sm:flex">
                  <Weight className="w-3 h-3" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {Math.round(sevkiyat.total_agirlik!)}
                  </span> kg
                </span>
              )}
            </div>
          </div>

          {/* Tutar */}
          {(sevkiyat.total_fiyat ?? 0) > 0 && (
            <div className="text-right mb-3">
              <span className="text-sm font-bold text-foreground">
                {currencySymbol}{sevkiyat.total_fiyat!.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {sevkiyat.sevk_tarihi
                ? formatDate(sevkiyat.sevk_tarihi)
                : formatDate(sevkiyat.created_at)}
            </div>

            {durum === "bekliyor" && (
              <Button
                size="sm"
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleStartPrep}
                disabled={loading}
              >
                <PackageCheck className="w-4 h-4 mr-1" />
                Haz\u0131rla
              </Button>
            )}

            {durum === "hazirlaniyor" && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
              >
                <Package className="w-4 h-4 mr-1" />
                Detay
              </Button>
            )}

            {durum === "yolda" && (
              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-300">
                Yolda
              </Badge>
            )}

            {isTeslim && (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </Card>

      <SevkiyatDetailSheet
        sevkiyat={sevkiyat}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
