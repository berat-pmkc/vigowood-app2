"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { FiyatlarToolbar } from "./fiyatlar-toolbar";
import { FiyatEditSheet, type ProductOption } from "./fiyat-edit-sheet";
import { getFiyatColumns } from "./fiyat-columns";
import { deleteFiyat, type FiyatRow } from "../actions";
import type { ShipmentCountry } from "@/lib/shipment-settings-types";
import { toast } from "sonner";

interface FiyatlarDataTableProps {
  data: FiyatRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  countryCode: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  products: ProductOption[];
  ulkeler: ShipmentCountry[];
}

export function FiyatlarDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  countryCode,
  sortBy,
  sortOrder,
  products,
  ulkeler,
}: FiyatlarDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editFiyat, setEditFiyat] = useState<FiyatRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [, startTransition] = useTransition();

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
      return `/admin/fiyatlar?${params.toString()}`;
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

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({
        sortBy: columnId,
        sortOrder: desc ? "desc" : "asc",
        page: "0",
      });
    },
    [navigate]
  );

  const handleEdit = useCallback((fiyat: FiyatRow) => {
    setEditFiyat(fiyat);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    (fiyat: FiyatRow) => {
      if (!confirm(`${fiyat.sku} (${fiyat.country_code}) fiyatını silmek istediğinize emin misiniz?`)) return;
      startTransition(async () => {
        const result = await deleteFiyat(fiyat.id);
        if (result.success) {
          toast.success("Fiyat silindi");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [router]
  );

  const handleAddNew = useCallback(() => {
    setEditFiyat(null);
    setIsNew(true);
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getFiyatColumns({
        onSort: handleSort,
        onEdit: handleEdit,
        onDelete: handleDelete,
        ulkeler,
      }),
    [handleSort, handleEdit, handleDelete, ulkeler]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => String(row.id),
  });

  return (
    <div className="space-y-4">
      <FiyatlarToolbar
        search={search}
        countryCode={countryCode}
        onAddNew={handleAddNew}
        ulkeler={ulkeler}
      />

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Fiyat kaydı bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <FiyatEditSheet
        fiyat={editFiyat}
        isNew={isNew}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) router.refresh();
        }}
        products={products}
        ulkeler={ulkeler}
      />
    </div>
  );
}
