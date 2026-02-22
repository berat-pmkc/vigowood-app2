"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SevkiyatCard, type SevkiyatRow } from "./sevkiyat-card";
import { SEVKIYAT_STATUS, SEVKIYAT_STATUS_LABELS } from "@/lib/constants";
import type { ShipmentCountry, KonteynerTipi } from "@/lib/shipment-settings-types";
import { useSevkiyatRealtime } from "@/hooks/use-sevkiyat-realtime";
import { Plus, Truck } from "lucide-react";
import Link from "next/link";

interface SevkiyatListProps {
  sevkiyatlar: SevkiyatRow[];
  counts: Record<string, number>;
  selectedStatus: string;
  selectedCountry: string;
  ulkeler: ShipmentCountry[];
  konteynerTipleri: KonteynerTipi[];
}

export function SevkiyatList({ sevkiyatlar, counts, selectedStatus, selectedCountry, ulkeler, konteynerTipleri }: SevkiyatListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  useSevkiyatRealtime();

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("durum", status);
    router.push(`/sevkiyat?${params.toString()}`);
  };

  const handleCountryChange = (country: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (country === "all") {
      params.delete("ulke");
    } else {
      params.set("ulke", country);
    }
    router.push(`/sevkiyat?${params.toString()}`);
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Sevkiyat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sevkiyat listesi ve konteyner yönetimi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden md:flex">
            <Link href="/sevkiyat/yeni">
              <Plus className="w-4 h-4 mr-1" />
              Yeni Sevkiyat
            </Link>
          </Button>
        </div>
      </div>

      {/* Country filter */}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant={selectedCountry === "all" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => handleCountryChange("all")}
        >
          Tümü
        </Button>
        {ulkeler.map((c) => (
          <Button
            key={c.code}
            variant={selectedCountry === c.code ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => handleCountryChange(c.code)}
          >
            {c.code} - {c.name}
          </Button>
        ))}
      </div>

      {/* Status tabs */}
      <Tabs value={selectedStatus} onValueChange={handleStatusChange}>
        <TabsList className="w-full grid grid-cols-6">
          <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm">
            Tümü
            <Badge variant="secondary" className="ml-1 text-xs">{totalCount}</Badge>
          </TabsTrigger>
          {SEVKIYAT_STATUS.map((status) => (
            <TabsTrigger key={status} value={status} className="gap-1 text-xs sm:text-sm">
              <span className="hidden sm:inline">{SEVKIYAT_STATUS_LABELS[status]}</span>
              <span className="sm:hidden">
                {status === "bekliyor" && "Bek."}
                {status === "hazirlaniyor" && "Haz."}
                {status === "yolda" && "Yolda"}
                {status === "teslim_edildi" && "Tes."}
                {status === "iptal_edildi" && "İpt."}
              </span>
              {(counts[status] ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {counts[status]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cards grid */}
      {sevkiyatlar.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Truck className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">Sevkiyat bulunamadı</p>
          <p className="text-sm mt-1">Seçili filtre için kayıt yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {sevkiyatlar.map((s) => (
            <SevkiyatCard key={s.sevkiyat_id} sevkiyat={s} />
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      <Button
        asChild
        className="fixed bottom-24 right-4 md:bottom-8 md:hidden w-14 h-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        <Link href="/sevkiyat/yeni">
          <Plus className="w-6 h-6" />
        </Link>
      </Button>
    </div>
  );
}
