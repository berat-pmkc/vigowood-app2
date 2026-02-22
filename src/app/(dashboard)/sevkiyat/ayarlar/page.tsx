import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { SevkiyatAyarlarClient } from "./components/sevkiyat-ayarlar-client";

export const metadata: Metadata = { title: "Sevkiyat Ayarları" };

export default async function SevkiyatAyarlarPage() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect("/sevkiyat");

  const settings = await getShipmentSettings();

  return (
    <div className="px-4 pb-6 sm:px-6">
      <SevkiyatAyarlarClient settings={settings} />
    </div>
  );
}
