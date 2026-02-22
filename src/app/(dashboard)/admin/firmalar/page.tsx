import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/auth";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { getCachedFirmalar } from "@/lib/cached-queries";
import { FirmalarClient } from "./components/firmalar-client";
import type { SevkiyatFirmaRow } from "@/app/(dashboard)/sevkiyat/actions";

export const metadata: Metadata = { title: "Firmalar" };

export default async function FirmalarPage() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect("/");
  }

  const [firmalar, settings] = await Promise.all([
    getCachedFirmalar(),
    getShipmentSettings(),
  ]);

  return (
    <FirmalarClient
      firmalar={(firmalar ?? []) as SevkiyatFirmaRow[]}
      firmaTipleri={settings.firmaTipleri}
      ulkeler={settings.ulkeler}
    />
  );
}
