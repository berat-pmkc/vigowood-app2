import type { Metadata } from "next";
import { getSalesSettings } from "@/lib/sales-settings";
import { SatisAyarlarClient } from "./components/satis-ayarlar-client";

export const metadata: Metadata = { title: "Satış Ayarları" };

export default async function SatisAyarlarPage() {
  const settings = await getSalesSettings();

  return (
    <div className="px-4 pb-6 sm:px-6">
      <SatisAyarlarClient settings={settings} />
    </div>
  );
}
