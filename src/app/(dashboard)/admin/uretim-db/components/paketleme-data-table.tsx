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
import { PaketlemeToolbar } from "./paketleme-toolbar";
import { PaketlemeEditSheet } from "./paketleme-edit-sheet";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { getPaketlemeColumns } from "./paketleme-columns";
import { deletePackEvent } from "../actions";
import { toast } from "sonner";
import type { PackEvent } from "@/lib/supabase/types";

interface PaketlemeDataTableProps {
  data: PackEvent[];
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

export function PaketlemeDataTable({
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
}: PaketlemeDataTableProps) {
  const router = useRouter();
  const [editEvent, setEditEvent] = useState<PackEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<PackEvent | null>(null);

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({ sortBy: columnId, sortOrder: desc ? "desc" : "asc", page: "0" });
    },
    [navigate]
  );

  const handleEdit = useCallback((event: PackEvent) => {
    setEditEvent(event);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback((event: PackEvent) => {
    setDeleteEvent(event);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteEvent) return;
    const result = await deletePackEvent(deleteEvent.session_id);
    if (result.success) {
      toast.success(`${deleteEvent.session_id} silindi`);
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
    () => getPaketlemeColumns({ onSort: handleSort, onEdit: handleEdit, onDelete: handleDelete }),
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
      <PaketlemeToolbar
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

      <DataTable table={table} emptyMessage="Paketleme seansı bulunamadı." />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) => navigate({ pageSize: String(size), page: "0" })}
      />

      <PaketlemeEditSheet
        event={editEvent}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />

      <DeleteConfirmDialog
        open={deleteEvent !== null}
        onOpenChange={(open) => !open && setDeleteEvent(null)}
        title="Paketleme Seansını Sil"
        description={`${deleteEvent?.session_id} kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
