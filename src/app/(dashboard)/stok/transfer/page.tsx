import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { TransferClient } from "./components/transfer-client";
import type { TransferRow } from "./components/transfers-data-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Depo Transferi" };

interface TransferMovementRow {
  sku: string | null;
  depo_id: string | null;
  qty: number;
  tarih: string | null;
  source_row_id: string | null;
  created_at: string;
}

export default async function DepoTransferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!STOCK_ACCESS_ROLES.includes(user.role)) redirect("/");

  const supabase = await createClient();

  const [productsRes, depolarRes, movementsRes] = await Promise.all([
    supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("sku"),
    supabase
      .from("depolar")
      .select("depo_id, ad")
      .eq("aktif", true)
      .order("sira"),
    supabase
      .from("stock_movements")
      .select("sku, depo_id, qty, tarih, source_row_id, created_at")
      .eq("source", "Transfer")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  const products = productsRes.data ?? [];
  const depolar = depolarRes.data ?? [];
  const depoAdi = new Map(depolar.map((d) => [d.depo_id, d.ad]));

  // Ürün adlarını topluca çek (transfer geçmişindeki SKU'lar için)
  const movementSkus = Array.from(
    new Set(((movementsRes.data ?? []) as TransferMovementRow[]).map((m) => m.sku).filter(Boolean)),
  ) as string[];
  const urunAdi = new Map<string, string>();
  if (movementSkus.length > 0) {
    const { data: urunler } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", movementSkus);
    (urunler ?? []).forEach((p) => {
      if (p.urun_adi) urunAdi.set(p.sku, p.urun_adi);
    });
  }

  // depo_transfer fonksiyonu her transferi 2 harekete yazar (çıkış -C / giriş -G),
  // ikisi de aynı source_row_id'yi paylaşır. Burada çift satırı tek transfer kaydına indirgiyoruz.
  const gruplar = new Map<string, TransferMovementRow[]>();
  ((movementsRes.data ?? []) as TransferMovementRow[]).forEach((m) => {
    const key = m.source_row_id || m.created_at;
    if (!gruplar.has(key)) gruplar.set(key, []);
    gruplar.get(key)!.push(m);
  });

  const transfers: TransferRow[] = Array.from(gruplar.entries())
    .map(([key, rows]) => {
      const cikis = rows.find((r) => r.qty < 0);
      const giris = rows.find((r) => r.qty > 0);
      const ref = cikis ?? giris ?? rows[0];
      return {
        id: key,
        tarih: ref?.tarih ?? ref?.created_at ?? null,
        sku: ref?.sku ?? null,
        urunAdi: ref?.sku ? urunAdi.get(ref.sku) ?? null : null,
        kaynakDepoId: cikis?.depo_id ?? null,
        kaynakDepoAdi: cikis?.depo_id ? depoAdi.get(cikis.depo_id) ?? cikis.depo_id : null,
        hedefDepoId: giris?.depo_id ?? null,
        hedefDepoAdi: giris?.depo_id ? depoAdi.get(giris.depo_id) ?? giris.depo_id : null,
        miktar: giris ? giris.qty : cikis ? Math.abs(cikis.qty) : 0,
      };
    })
    .sort((a, b) => (b.tarih ?? "").localeCompare(a.tarih ?? ""))
    .slice(0, 50);

  return (
    <div className="space-y-4 px-4 pb-20 sm:px-6 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Depo Transferi</h1>
        <p className="text-sm text-muted-foreground">
          Ürünü bir depodan diğerine aktarın
        </p>
      </div>

      <TransferClient products={products} depolar={depolar} transfers={transfers} />
    </div>
  );
}
