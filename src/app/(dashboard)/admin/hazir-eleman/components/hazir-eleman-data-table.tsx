"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
import { HazirElemanToolbar } from "./hazir-eleman-toolbar";
import { HazirElemanEditSheet, type ElemanPrefix } from "./hazir-eleman-edit-sheet";
import { getHazirElemanColumns } from "./hazir-eleman-columns";
import { getNextHPCode, getNextMDFCode, deleteHazirEleman } from "../actions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface HazirElemanDataTableProps {
  data: AllPart[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function HazirElemanDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  sortBy,
  sortOrder,
}: HazirElemanDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editPart, setEditPart] = useState<AllPart | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
  const [nextCode, setNextCode] = useState("HP0001");
  const [createPrefix, setCreatePrefix] = useState<ElemanPrefix>("HP");
  const [deleteTarget, setDeleteTarget] = useState<AllPart | null>(null);
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
      return `/admin/hazir-eleman?${params.toString()}`;
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

  const handleDelete = useCallback((part: AllPart) => {
    setDeleteTarget(part);
  }, []);

  const handleCreate = useCallback(async (prefix: ElemanPrefix = "HP") => {
    const code = prefix === "MDF" ? await getNextMDFCode() : await getNextHPCode();
    setNextCode(code);
    setCreatePrefix(prefix);
    setEditPart(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteHazirEleman(deleteTarget.part_id);
      if (result.success) {
        toast.success(`${deleteTarget.part_id} silindi`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setDeleteTarget(null);
    });
  }, [deleteTarget, router]);

  // Fetch next code on mount for quick create
  useEffect(() => {
    getNextHPCode().then(setNextCode);
  }, []);

  const columns = useMemo(
    () =>
      getHazirElemanColumns({
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
    getRowId: (row) => row.part_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <HazirElemanToolbar
            search={search}
            onSearchChange={(v) =>
              navigate({ search: v || undefined, page: "0" })
            }
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              Yeni Hazır Eleman
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleCreate("HP")}>
              HP — Normal Hazır Eleman
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreate("MDF")}>
              MDF — MDF Hammadde
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Hazır eleman bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <HazirElemanEditSheet
        part={editPart}
        mode={sheetMode}
        nextCode={nextCode}
        prefix={createPrefix}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={async () => {
          router.refresh();
          // Refresh next code after create
          const code = createPrefix === "MDF" ? await getNextMDFCode() : await getNextHPCode();
          setNextCode(code);
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hazır eleman sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.part_id}</strong> —{" "}
              {deleteTarget?.part_adi || "İsimsiz"} silinecek. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
