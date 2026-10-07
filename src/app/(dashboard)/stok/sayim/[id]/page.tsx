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

  // Yeni kolonlar (baslangic_zamani, uygunsuz_qty, ...) üretilmiş tiplerde henüz yok
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [basRes, satirRes, pencereRes] = await Promise.all([
    sb
      .from("stok_sayimlari")
      .select("sayim_id, ad, sayim_tarihi, kapsam, durum, notlar, tamamlanma_zamani, baslangic_zamani")
      .eq("sayim_id", id)
      .maybeSingle(),
    sb
      .from("stok_sayim_satirlari")
      .select(
        "id, kalem_tipi, kalem_id, kalem_adi, kategori, sistem_miktar, sayilan_miktar, fark, not_text, uygunsuz_qty, fire_qty, pencere_miktar, nihai_miktar, canli_sistem, uygulanan_fark",
      )
      .eq("sayim_id", id)
      .order("kategori")
      .order("kalem_id"),
    // Taslakta canlı pencere (sayım başladığından beri giren/çıkan); tamamlananda satırda donmuş
    sb.rpc("stok_sayim_pencere", { p_sayim_id: id }),
  ]);

  if (!basRes.data) notFound();
  const pencere = (pencereRes.data ?? []) as {
    satir_id: string; kalem_id: string; pencere_miktar: number; canli_sistem: number;
  }[];

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
        pencere={pencere}
      />
    </div>
  );
}
