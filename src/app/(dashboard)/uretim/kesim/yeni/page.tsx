import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { YeniKesimForm } from "../components/yeni-kesim-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Yeni Kesim" };

export default async function YeniKesimPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Aktif ürünleri getir
  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi, kategori")
    .eq("aktif_mi", true)
    .order("urun_adi");

  return (
    <div className="pb-20 md:pb-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/uretim/kesim">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Kesim Listesi
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Yeni Kesim</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adım adım yeni kesim kaydı oluşturun
        </p>
      </div>

      <YeniKesimForm products={products ?? []} />
    </div>
  );
}
