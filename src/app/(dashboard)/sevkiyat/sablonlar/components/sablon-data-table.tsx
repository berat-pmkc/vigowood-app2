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
import { SablonToolbar } from "./sablon-toolbar";
import { SablonEditSheet } from "./sablon-edit-sheet";
import { getSablonColumns } from "./sablon-columns";
import { deletePaletSablon, type PaletSablonRow } from "../actions";
import { toast } from "sonner";

interface SablonDataTableProps {
  data: PaletSablonRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  paletBoyut: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  paletBoyutlari: string[];
}

export function SablonDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  paletBoyut,
  sortBy,
  sortOrder,
  paletBoyutlari,
}: SablonDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editSablon, setEditSablon] = useState<PaletSablonRow | null>(null);
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
      return `/sevkiyat/sablonlar?${params.toString()}`;
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

  const handleEdit = useCallback((sablon: PaletSablonRow) => {
    setEditSablon(sablon);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    (sablon: PaletSablonRow) => {
      if (!confirm(`${sablon.sku} (${sablon.palet_boyut}) şablonunu silmek istediğinize emin misiniz?`)) return;
      startTransition(async () => {
        const result = await deletePaletSablon(sablon.id);
        if (result.success) {
          toast.success("Şablon silindi");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [router]
  );

  const handleAddNew = useCallback(() => {
    setEditSablon(null);
    setIsNew(true);
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getSablonColumns({
        onSort: handleSort,
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    [handleSort, handleEdit, handleDelete]
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
      <SablonToolbar
        search={search}
        paletBoyut={paletBoyut}
        onAddNew={handleAddNew}
        paletBoyutlari={paletBoyutlari}
      />

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Palet şablonu bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <SablonEditSheet
        sablon={editSablon}
        isNew={isNew}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) router.refresh();
        }}
        paletBoyutlari={paletBoyutlari}
      />
    </div>
  );
}
