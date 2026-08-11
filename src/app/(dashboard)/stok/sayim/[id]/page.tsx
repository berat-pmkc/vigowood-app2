import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SayimDetayClient } from "./components/sayim-detay-client";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SayimDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!STOCK_ACCESS_ROLES.includes(user.role)) redirect("/");

  const supabase = await createClient();

  const [basRes, satirRes] = await Promise.all([
    supabase
      .from("stok_sayimlari")
      .select("sayim_id, ad, sayim_tarihi, kapsam, durum, notlar, tamamlanma_zamani")
      .eq("sayim_id", id)
      .maybeSingle(),
    supabase
      .from("stok_sayim_satirlari")
      .select("id, kalem_tipi, kalem_id, kalem_adi, kategori, sistem_miktar, sayilan_miktar, fark, not_text")
      .eq("sayim_id", id)
      .order("kategori")
      .order("kalem_id"),
  ]);

  if (!basRes.data) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/stok/sayim">
            <ChevronLeft className="mr-1 size-4" />
            Sayımlar
          </Link>
        </Button>
      </div>
      <SayimDetayClient
        baslik={basRes.data}
        satirlar={satirRes.data ?? []}
      />
    </div>
  );
}
