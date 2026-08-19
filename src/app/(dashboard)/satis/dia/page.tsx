import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SATIS_ACCESS_ROLES } from "@/lib/constants";
import { getDiaSatisAyarlari } from "@/lib/dia/satis";
import { diaGunlukOku } from "./actions";
import { DiaClient } from "./components/dia-client";

export const metadata: Metadata = { title: "DİA Entegrasyonu" };

export default async function DiaPage() {
  const user = await getCurrentUser();
  if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) redirect("/");

  const [ayarlar, gunluk] = await Promise.all([
    getDiaSatisAyarlari(),
    diaGunlukOku(30),
  ]);

  return (
    <div className="px-4 pb-6 sm:px-6">
      <DiaClient ayarlar={ayarlar} gunluk={gunluk} />
    </div>
  );
}
