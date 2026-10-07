import type { Metadata } from "next";
import { loadTreeData } from "./data";
import { PlakalarTreeClient } from "./components/plakalar-tree-client";

export const metadata: Metadata = { title: "Plaka Yonetimi" };

// Ağaçta yapılan değişiklikler anında görünmeli (tablet kesim ekranıyla aynı veri)
export const dynamic = "force-dynamic";

export default async function PlakalarPage() {
  let data;
  try {
    data = await loadTreeData();
  } catch (e) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {e instanceof Error ? e.message : "bilinmeyen hata"}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Plaka Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Ürün → plaka → parça ağacı. Buradaki değişiklikler tablet kesim ekranına anında yansır.
        </p>
      </div>
      <PlakalarTreeClient data={data} />
    </div>
  );
}
