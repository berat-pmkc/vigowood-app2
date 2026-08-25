import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { KesimRaporClient } from "./components/kesim-rapor-client";

export const metadata: Metadata = { title: "Kesimhane Raporu" };

export default async function KesimRaporPage() {
  const user = await getCurrentUser();
  if (!user || !URETIM_ANALIZ_ROLES.includes(user.role)) redirect("/");
  return (
    <div className="px-4 pb-6 sm:px-6">
      <KesimRaporClient />
    </div>
  );
}
