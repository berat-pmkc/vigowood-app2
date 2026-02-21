import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MakinelerTable } from "./components/makineler-table";

export const metadata: Metadata = { title: "Makine Yönetimi" };

export default async function MakinelerPage() {
  const supabase = await createClient();

  const { data: makineler, error } = await supabase
    .from("kesim_makinesi")
    .select("*")
    .order("bolum")
    .order("makine_id");

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Makine Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Üretim makinelerini yönetin. Her makinenin bölümü, ilgili üretim formlarında kullanılır.
        </p>
      </div>
      <MakinelerTable data={(makineler as any[]) ?? []} />
    </div>
  );
}
