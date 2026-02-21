"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { ProductsToolbar } from "./products-toolbar";
import { ProductEditSheet } from "./product-edit-sheet";
import { getProductColumns } from "./product-columns";
import { updateProduct } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductsDataTableProps {
  data: Product[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  kategori: string;
  aktif: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function ProductsDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  kategori,
  aktif,
  sortBy,
  sortOrder,
}: ProductsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Build URL with new params
  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/admin/urunler?${params.toString()}`;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        router.push(buildUrl(updates));
      });
    },
    [buildUrl, router]
  );

  // Sorting state (server-driven)
  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({
        sortBy: columnId,
        sortOrder: desc ? "desc" : "asc",
        page: "0", // Reset page on sort change
      });
    },
    [navigate]
  );

  const handleEdit = useCallback((product: Product) => {
    setEditProduct(product);
    setSheetOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (product: Product) => {
      startTransition(async () => {
        const result = await updateProduct(product.sku, {
          urun_adi: product.urun_adi || "",
          kategori: product.kategori || "AT EVİ",
          aktif_mi: !product.aktif_mi,
        });
        if (result.success) {
          toast.success(
            `${product.sku} ${!product.aktif_mi ? "aktif" : "pasif"} yapıldı`
          );
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [router]
  );

  const columns = useMemo(
    () =>
      getProductColumns({
        onSort: handleSort,
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
      }),
    [handleSort, handleEdit, handleToggleActive]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination: { pageIndex, pageSize },
    },
    pageCount: Math.ceil(totalCount / pageSize),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.sku,
  });

  return (
    <div className="space-y-4">
      {/* TEMPORARY DEBUG — remove after diagnosis */}
      <div className="rounded border border-green-300 bg-green-50 p-3 text-xs font-mono">
        <p><strong>CLIENT DEBUG:</strong></p>
        <p>data.length: {data.length}</p>
        <p>totalCount: {totalCount}</p>
        <p>table rows: {table.getRowModel().rows.length}</p>
        <p>columns: {columns.length}</p>
        <p>first item: {data[0] ? JSON.stringify({ sku: (data[0] as Product).sku }) : "EMPTY"}</p>
      </div>
      <ProductsToolbar
        table={table}
        search={search}
        kategori={kategori}
        aktif={aktif}
        onSearchChange={(v) => navigate({ search: v || undefined, page: "0" })}
        onKategoriChange={(v) => navigate({ kategori: v || undefined, page: "0" })}
        onAktifChange={(v) => navigate({ aktif: v || undefined, page: "0" })}
        onBulkActionDone={() => router.refresh()}
      />

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Ürün bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <ProductEditSheet
        product={editProduct}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
