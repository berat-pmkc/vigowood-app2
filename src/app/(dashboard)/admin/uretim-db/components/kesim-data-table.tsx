"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { KesimToolbar } from "./kesim-toolbar";
import { KesimEditSheet } from "./kesim-edit-sheet";
import { CutLineEditSheet } from "./cut-line-edit-sheet";
import { KesimExpandableRow } from "./kesim-expandable-row";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { getKesimColumns } from "./kesim-columns";
import { deleteCutBatch, deleteCutLine } from "../actions";
import { toast } from "sonner";
import type { CutBatch, CutLine } from "@/lib/supabase/types";

interface KesimDataTableProps {
  data: CutBatch[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  durum: string;
  makine: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  navigate: (updates: Record<string, string | undefined>) => void;
}

export function KesimDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  durum,
  makine,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
  navigate,
}: KesimDataTableProps) {
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editBatch, setEditBatch] = useState<CutBatch | null>(null);
  const [editLine, setEditLine] = useState<CutLine | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lineSheetOpen, setLineSheetOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: "batch"; item: CutBatch } | { type: "line"; item: CutLine } | null>(null);

  const toggleExpand = useCallback((cutId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [cutId]: !prev[cutId],
    }));
  }, []);

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

  const handleEdit = useCallback((batch: CutBatch) => {
    setEditBatch(batch);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback((batch: CutBatch) => {
    setDeleteItem({ type: "batch", item: batch });
  }, []);

  const handleEditLine = useCallback((line: CutLine) => {
    setEditLine(line);
    setLineSheetOpen(true);
  }, []);

  const handleDeleteLine = useCallback((line: CutLine) => {
    setDeleteItem({ type: "line", item: line });
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    if (deleteItem.type === "batch") {
      const result = await deleteCutBatch(deleteItem.item.cut_id);
      if (result.success) {
        toast.success(`${deleteItem.item.cut_id} silindi`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await deleteCutLine(deleteItem.item.cut_line_id);
      if (result.success) {
        toast.success(`${deleteItem.item.cut_line_id} silindi`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    }
  };

  const sorting: SortingState = useMemo(
    () => (sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : []),
    [sortBy, sortOrder]
  );

  const columns = useMemo(
    () =>
      getKesimColumns({
        onSort: handleSort,
        onEdit: handleEdit,
        onDelete: handleDelete,
        expandedRows,
        onToggleExpand: toggleExpand,
      }),
    [handleSort, handleEdit, handleDelete, expandedRows, toggleExpand]
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
    getRowId: (row) => row.cut_id,
  });

  return (
    <div className="space-y-4">
      <KesimToolbar
        search={search}
        durum={durum}
        makine={makine}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSearchChange={(v) => navigate({ search: v || undefined, page: "0" })}
        onDurumChange={(v) => navigate({ durum: v || undefined, page: "0" })}
        onMakineChange={(v) => navigate({ makine: v || undefined, page: "0" })}
        onDateFromChange={(v) => navigate({ dateFrom: v || undefined, page: "0" })}
        onDateToChange={(v) => navigate({ dateTo: v || undefined, page: "0" })}
        onClear={() =>
          navigate({
            search: undefined,
            durum: undefined,
            makine: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            page: "0",
          })
        }
      />

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.getSize() !== 150 ? header.getSize() : undefined,
                    }}
                    className={
                      (header.column.columnDef.meta as Record<string, unknown>)
                        ?.className as string | undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <>
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as Record<string, unknown>)
                            ?.className as string | undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandedRows[row.original.cut_id] && (
                    <KesimExpandableRow
                      key={`${row.id}-expanded`}
                      cutId={row.original.cut_id}
                      colSpan={columns.length}
                      onEditLine={handleEditLine}
                      onDeleteLine={handleDeleteLine}
                    />
                  )}
                </>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Kesim kaydı bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) => navigate({ pageSize: String(size), page: "0" })}
      />

      <KesimEditSheet
        batch={editBatch}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />

      <CutLineEditSheet
        line={editLine}
        open={lineSheetOpen}
        onOpenChange={setLineSheetOpen}
        onSaved={() => router.refresh()}
      />

      <DeleteConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title={
          deleteItem?.type === "batch"
            ? "Kesim Kaydını Sil"
            : "Kesim Satırını Sil"
        }
        description={
          deleteItem?.type === "batch"
            ? `${(deleteItem.item as CutBatch).cut_id} kalıcı olarak silinecek. İlişkili tüm kesim satırları da silinecektir. Bu işlem geri alınamaz.`
            : `${deleteItem ? (deleteItem.item as CutLine).cut_line_id : ""} kalıcı olarak silinecek. Bu işlem geri alınamaz.`
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
