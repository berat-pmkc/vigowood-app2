import { createClient } from "@/lib/supabase/server";
import { KargoClient } from "./components/kargo-client";

export default async function KargoPage() {
  // Cast to any — new tables not yet in generated Supabase types
  const supabase = (await createClient()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [
    { data: providers },
    { data: marketplaces },
    { data: mappings },
  ] = await Promise.all([
    supabase.from("shipping_providers").select("*").order("name"),
    supabase.from("marketplaces").select("*").order("sira"),
    supabase.from("marketplace_shipping").select("*"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Kargo Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Kargo firmaları, desi tabloları ve pazaryeri eşleştirmeleri
        </p>
      </div>

      <KargoClient
        providers={(providers ?? []) as any[]}
        marketplaces={(marketplaces ?? []) as any[]}
        mappings={(mappings ?? []) as any[]}
      />
    </div>
  );
}
