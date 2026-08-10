import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { getPlanlamaUrunleri } from "./actions";
import { PlanlamaClient } from "./components/planlama-client";

export const metadata: Metadata = { title: "Sevkiyat Planlama" };

export default async function SevkiyatPlanlamaPage() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) redirect("/");

  const [urunler, ayarlar] = await Promise.all([
    getPlanlamaUrunleri(),
    getShipmentSettings(),
  ]);

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sevkiyat Planlama</h1>
        <p className="text-sm text-muted-foreground">
          Ürünleri seçin, sistem konteyneri en verimli şekilde dizsin. Adetleri
          değiştirip yeniden hesaplatabilirsiniz.
        </p>
      </div>

      <PlanlamaClient urunler={urunler} konteynerTipleri={ayarlar.konteynerTipleri} />
    </div>
  );
}
