import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { computeKritikStokOnerileri } from "@/lib/kritikStok";
import { getKritikStokUyari } from "./actions";
import { KritikStokClient } from "./components/kritik-stok-client";

export const metadata: Metadata = { title: "Kritik Stok Yönetimi" };

export default async function KritikStokPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const canEdit = !!user && STOCK_ACCESS_ROLES.includes(user.role);

  const [oneriler, sariEsik] = await Promise.all([
    computeKritikStokOnerileri(supabase),
    getKritikStokUyari(),
  ]);

  return (
    <div className="px-4 sm:px-6">
      <KritikStokClient data={oneriler} canEdit={canEdit} initialSariEsik={sariEsik} />
    </div>
  );
}
