"use client";

import { TransferForm } from "./transfer-form";
import { TransfersDataTable, type TransferRow } from "./transfers-data-table";

interface Product {
  sku: string;
  urun_adi: string | null;
}

interface Depo {
  depo_id: string;
  ad: string;
}

export function TransferClient({
  products,
  depolar,
  transfers,
}: {
  products: Product[];
  depolar: Depo[];
  transfers: TransferRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <TransferForm products={products} depolar={depolar} />

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Son Transferler</h2>
        <TransfersDataTable data={transfers} />
      </div>
    </div>
  );
}
