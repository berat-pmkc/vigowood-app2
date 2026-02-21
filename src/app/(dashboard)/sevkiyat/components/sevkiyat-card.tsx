"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SevkiyatStatusBadge } from "./sevkiyat-status-badge";
import {
  SEVKIYAT_STATUS_BORDER_COLORS,
  type SevkiyatStatus,
} from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import {
  Calendar,
  Container,
  Package,
  Weight,
  Box,
  TruckIcon,
} from "lucide-react";

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
  arac_tipi: string | null;
  tir_plaka: string | null;
  planlanan_sevk_tarihi: string | null;
  gerceklesen_sevk_tarihi: string | null;
  ihracatci_firma_id: number | null;
  alici_firma_id: number | null;
  banka_firma_id: number | null;
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
  const router = useRouter();

  const durum = sevkiyat.durum as SevkiyatStatus;
  const borderColor = SEVKIYAT_STATUS_BORDER_COLORS[durum] ?? SEVKIYAT_STATUS_BORDER_COLORS.bekliyor;
  const isTeslim = durum === "teslim_edildi";

  const handleNavigate = () => {
    router.push(`/sevkiyat/${sevkiyat.sevkiyat_id}`);
  };

  // Tarih
  const tarih = sevkiyat.planlanan_sevk_tarihi ?? sevkiyat.sevk_tarihi ?? sevkiyat.created_at;

  // Araç bilgisi
  const aracInfo = sevkiyat.arac_tipi === "tir" && sevkiyat.tir_plaka
    ? sevkiyat.tir_plaka
    : sevkiyat.konteyner_no ?? null;
  const AracIcon = sevkiyat.arac_tipi === "tir" ? TruckIcon : Container;

  return (
    <Card
      className={cn(
        "border-l-4 cursor-pointer transition-all hover:shadow-md",
        borderColor,
        isTeslim && "opacity-60"
      )}
      onClick={handleNavigate}
    >
      <div className="px-3 py-2.5">
        {/* Row 1: ID + Name + Status */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-5 shrink-0">
              {sevkiyat.sevkiyat_id}
            </Badge>
            <span className="text-sm font-medium text-foreground truncate">
              {sevkiyat.sevkiyat_adi || sevkiyat.musteri}
            </span>
          </div>
          <SevkiyatStatusBadge durum={sevkiyat.durum} />
        </div>

        {/* Row 2: Date | Vehicle | Stats — single line */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5 shrink-0">
            <Calendar className="w-3 h-3" />
            {formatDate(tarih)}
          </span>

          {aracInfo && (
            <span className="flex items-center gap-0.5 shrink-0">
              <AracIcon className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{aracInfo}</span>
            </span>
          )}

          <span className="flex-1" />

          {(sevkiyat.total_palet ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Box className="w-3 h-3" />
              <span className="font-semibold tabular-nums text-foreground">{sevkiyat.total_palet}</span>plt
            </span>
          )}
          {(sevkiyat.total_koli ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Package className="w-3 h-3" />
              <span className="font-semibold tabular-nums text-foreground">{sevkiyat.total_koli}</span>koli
            </span>
          )}
          {(sevkiyat.total_agirlik ?? 0) > 0 && (
            <span className="items-center gap-0.5 hidden sm:flex">
              <Weight className="w-3 h-3" />
              <span className="font-semibold tabular-nums text-foreground">
                {Math.round(sevkiyat.total_agirlik! / 1000)}t
              </span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
