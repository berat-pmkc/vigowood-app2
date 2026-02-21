"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { Plus, List, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { PlakalarToolbar } from "./plakalar-toolbar";
import { PlakaEditSheet } from "./plaka-edit-sheet";
import { getPlakaColumns } from "./plaka-columns";
import { PlakaParcalariView } from "./plaka-parcalari-view";
import type { Database } from "@/lib/supabase/types";

type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

interface PlakalarDataTableProps {
  data: Plaka[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sku: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  skuOptions: string[];
  initialView: "liste" | "parcalar";
  initialPlaka: string;
}

export function PlakalarDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  sku,
  sortBy,
  sortOrder,
  skuOptions,
  initialView,
  initialPlaka,
}: PlakalarDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editPlaka, setEditPlaka] = useState<Plaka | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
  const [, startTransition] = useTransition();
  const [activeView, setActiveView] = useState<"liste" | "parcalar">(initialView);

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
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditPlaka(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const handleViewChange = useCallback(
    (view: "liste" | "parcalar") => {
      setActiveView(view);
      navigate({ view: view === "liste" ? undefined : view });
    },
    [navigate]
  );

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
      {/* View toggle + action buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          <Button
            variant={activeView === "liste" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => handleViewChange("liste")}
          >
            <List className="h-4 w-4" />
            Liste
          </Button>
          <Button
            variant={activeView === "parcalar" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => handleViewChange("parcalar")}
          >
            <Puzzle className="h-4 w-4" />
            Parçalar
          </Button>
        </div>
        <Button onClick={handleCreate} size="sm" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Plaka
        </Button>
      </div>

      {activeView === "liste" ? (
        <>
          <PlakalarToolbar
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
        </>
      ) : (
        <PlakaParcalariView initialPlaka={initialPlaka} />
      )}

      <PlakaEditSheet
        plaka={editPlaka}
        mode={sheetMode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
