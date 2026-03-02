"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { MontajToolbar } from "./montaj-toolbar";
import { MontajEditSheet } from "./montaj-edit-sheet";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { getMontajColumns } from "./montaj-columns";
import { deleteMontajSession } from "../actions";
import { toast } from "sonner";
import type { MontajSession } from "@/lib/supabase/types";

interface MontajDataTableProps {
  data: MontajSession[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  durum: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  navigate: (updates: Record<string, string | undefined>) => void;
}

export function MontajDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  durum,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
  navigate,
}: MontajDataTableProps) {
  const router = useRouter();
  const [editSession, setEditSession] = useState<MontajSession | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteSession, setDeleteSession] = useState<MontajSession | null>(null);

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({ sortBy: columnId, sortOrder: desc ? "desc" : "asc", page: "0" });
    },
    [navigate]
  );

  const handleEdit = useCallback((session: MontajSession) => {
    setEditSession(session);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback((session: MontajSession) => {
    setDeleteSession(session);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteSession) return;
    const result = await deleteMontajSession(deleteSession.session_id);
    if (result.success) {
      toast.success(`${deleteSession.session_id} silindi`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const sorting: SortingState = useMemo(
    () => (sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : []),
    [sortBy, sortOrder]
  );

  const columns = useMemo(
    () => getMontajColumns({ onSort: handleSort, onEdit: handleEdit, onDelete: handleDelete }),
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
    getRowId: (row) => row.session_id,
  });

  return (
    <div className="space-y-4">
      <MontajToolbar
        search={search}
        durum={durum}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSearchChange={(v) => navigate({ search: v || undefined, page: "0" })}
        onDurumChange={(v) => navigate({ durum: v || undefined, page: "0" })}
        onDateFromChange={(v) => navigate({ dateFrom: v || undefined, page: "0" })}
        onDateToChange={(v) => navigate({ dateTo: v || undefined, page: "0" })}
        onClear={() =>
          navigate({ search: undefined, durum: undefined, dateFrom: undefined, dateTo: undefined, page: "0" })
        }
      />

      <DataTable table={table} emptyMessage="Montaj seansı bulunamadı." />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) => navigate({ pageSize: String(size), page: "0" })}
      />

      <MontajEditSheet
        session={editSession}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />

      <DeleteConfirmDialog
        open={deleteSession !== null}
        onOpenChange={(open) => !open && setDeleteSession(null)}
        title="Montaj Seansını Sil"
        description={`${deleteSession?.session_id} kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
