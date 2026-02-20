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
import { PlakalarToolbar } from "./plakalar-toolbar";
import { PlakaEditSheet } from "./plaka-edit-sheet";
import { getPlakaColumns } from "./plaka-columns";
import type { Database } from "@/lib/supabase/types";

type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

interface PlakalarDataTableProps {
  data: Plaka[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  makine: string;
  sku: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  skuOptions: string[];
}

export function PlakalarDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  makine,
  sku,
  sortBy,
  sortOrder,
  skuOptions,
}: PlakalarDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editPlaka, setEditPlaka] = useState<Plaka | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      return `/admin/plakalar?${params.toString()}`;
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

  const handleEdit = useCallback((plaka: Plaka) => {
    setEditPlaka(plaka);
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getPlakaColumns({
        onSort: handleSort,
        onEdit: handleEdit,
      }),
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
      <PlakalarToolbar
        search={search}
        makine={makine}
        sku={sku}
        skuOptions={skuOptions}
        onSearchChange={(v) =>
          navigate({ search: v || undefined, page: "0" })
        }
        onMakineChange={(v) =>
          navigate({ makine: v || undefined, page: "0" })
        }
        onSkuChange={(v) => navigate({ sku: v || undefined, page: "0" })}
      />

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Plaka bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <PlakaEditSheet
        plaka={editPlaka}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
