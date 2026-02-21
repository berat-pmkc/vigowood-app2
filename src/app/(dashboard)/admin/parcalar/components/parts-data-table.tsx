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
import { PartsToolbar } from "./parts-toolbar";
import { PartEditSheet } from "./part-edit-sheet";
import { getPartColumns } from "./part-columns";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface PartsDataTableProps {
  data: AllPart[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  tip: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function PartsDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  tip,
  sortBy,
  sortOrder,
}: PartsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editPart, setEditPart] = useState<AllPart | null>(null);
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
      return `/admin/parcalar?${params.toString()}`;
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

  const handleEdit = useCallback((part: AllPart) => {
    setEditPart(part);
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditPart(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getPartColumns({
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
    getRowId: (row) => row.part_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <PartsToolbar
            search={search}
            tip={tip}
            onSearchChange={(v) => navigate({ search: v || undefined, page: "0" })}
            onTipChange={(v) => navigate({ tip: v || undefined, page: "0" })}
          />
        </div>
        <Button onClick={handleCreate} size="sm" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Parça
        </Button>
      </div>

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Parça bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <PartEditSheet
        part={editPart}
        mode={sheetMode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
