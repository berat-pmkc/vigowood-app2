"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { KartonSablonlarToolbar } from "./karton-sablonlar-toolbar";
import { KartonSablonEditSheet } from "./karton-sablon-edit-sheet";
import { getKartonSablonColumns, type KartonSablonRow } from "./karton-sablon-columns";

interface KartonSablonlarDataTableProps {
  data: KartonSablonRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sku: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  skuOptions: string[];
}

export function KartonSablonlarDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  sku,
  sortBy,
  sortOrder,
  skuOptions,
}: KartonSablonlarDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editSablon, setEditSablon] = useState<KartonSablonRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
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
      return `/admin/karton-sablonlari?${params.toString()}`;
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

  const handleEdit = useCallback((row: KartonSablonRow) => {
    setEditSablon(row);
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditSablon(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () => getKartonSablonColumns({ onSort: handleSort, onEdit: handleEdit }),
    [handleSort, handleEdit]
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
    getRowId: (row) => row.plakalar_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={handleCreate} size="sm" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Şablon
        </Button>
      </div>

      <KartonSablonlarToolbar
        search={search}
        sku={sku}
        skuOptions={skuOptions}
        onSearchChange={(v) =>
          navigate({ search: v || undefined, page: "0" })
        }
        onSkuChange={(v) => navigate({ sku: v || undefined, page: "0" })}
      />

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Karton şablon bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <KartonSablonEditSheet
        sablon={editSablon}
        mode={sheetMode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
