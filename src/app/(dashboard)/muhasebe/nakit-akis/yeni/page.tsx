import type { Metadata } from "next";
import { DonemForm } from "./components/donem-form";

export const metadata: Metadata = { title: "Yeni Dönem | Nakit Akış" };

export default function YeniDonemPage() {
  return (
    <div className="px-4 sm:px-6 pb-20 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Yeni Dönem Oluştur</h1>
        <p className="text-sm text-muted-foreground">
          Nakit akış dönem bilgilerini girin. Tüm alanlar otomatik toplanır.
        </p>
      </div>
      <DonemForm />
    </div>
  );
}
