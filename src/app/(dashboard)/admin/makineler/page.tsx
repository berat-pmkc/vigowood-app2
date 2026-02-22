import type { Metadata } from "next";
import { getCachedMachines } from "@/lib/cached-queries";
import { MakinelerTable } from "./components/makineler-table";

export const metadata: Metadata = { title: "Makine Yönetimi" };

export default async function MakinelerPage() {
  const makineler = await getCachedMachines();

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
