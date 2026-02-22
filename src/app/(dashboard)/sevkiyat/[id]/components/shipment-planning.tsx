"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShipmentHeader } from "./shipment-header";
import { ShipmentTable } from "./shipment-table";
import { AddItemRow } from "./add-item-row";
import { ShipmentSummary } from "./shipment-summary";
import { ShipmentActions } from "./shipment-actions";
import type { SevkiyatRow, SevkiyatItemRow } from "../../actions";
import type { KonteynerTipi, MaliyetAyarlari } from "@/lib/shipment-settings-types";

interface ShipmentPlanningProps {
  sevkiyat: SevkiyatRow;
  initialItems: SevkiyatItemRow[];
  products: {
    sku: string;
    urun_adi: string | null;
    kategori: string | null;
    stok_aktif: number;
  }[];
  konteynerTipleri: KonteynerTipi[];
  maliyetAyarlari: MaliyetAyarlari;
}

export function ShipmentPlanning({
  sevkiyat,
  initialItems,
  products,
  konteynerTipleri,
  maliyetAyarlari,
}: ShipmentPlanningProps) {
  const router = useRouter();
  const [items, setItems] = useState<SevkiyatItemRow[]>(initialItems);

  const durum = sevkiyat.durum;
  const isEditable = durum === "bekliyor" || durum === "hazirlaniyor";
  const countryCode = sevkiyat.country_code ?? "DE";

  // Toplam hesaplamaları
  const totals = items.reduce(
    (acc, item) => ({
      palet: acc.palet + (item.palet_sayisi ?? 0),
      koli: acc.koli + (item.toplam_koli ?? 0),
      adet: acc.adet + (item.qty ?? 0),
      agirlik: acc.agirlik + (item.agirlik ?? 0),
      hacim: acc.hacim + (item.hacim ?? 0),
      desi: acc.desi + (item.desi ?? 0),
    }),
    { palet: 0, koli: 0, adet: 0, agirlik: 0, hacim: 0, desi: 0 }
  );

  const handleItemAdded = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleItemUpdated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleItemDeleted = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((i) => i.item_id !== itemId));
      router.refresh();
    },
    [router]
  );

  const handleStatusChanged = useCallback(() => {
    router.refresh();
  }, [router]);

  // Sync items when server re-renders
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <ShipmentHeader sevkiyat={sevkiyat} konteynerTipleri={konteynerTipleri} />

      <ShipmentTable
        items={items}
        isEditable={isEditable}
        countryCode={countryCode}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
        totals={totals}
      />

      {isEditable && (
        <AddItemRow
          sevkiyatId={sevkiyat.sevkiyat_id}
          countryCode={countryCode}
          products={products}
          onItemAdded={handleItemAdded}
        />
      )}

      <ShipmentSummary totals={totals} />

      <ShipmentActions
        sevkiyat={sevkiyat}
        hasItems={items.length > 0}
        onStatusChanged={handleStatusChanged}
      />
    </div>
  );
}
