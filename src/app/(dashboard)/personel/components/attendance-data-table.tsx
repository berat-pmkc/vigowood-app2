"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  ATTENDANCE_DEPARTMENT_LABELS,
  ATTENDANCE_DEPARTMENT_COLORS,
  type AttendanceDepartment,
} from "@/lib/constants";
import { deleteAttendance } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceDataTableProps {
  data: AttendanceRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onEdit: (record: AttendanceRow) => void;
}

function DeptBadge({ department }: { department: string | null }) {
  if (!department) return <span className="text-muted-foreground">—</span>;
  const colors = ATTENDANCE_DEPARTMENT_COLORS[department as AttendanceDepartment];
  const label = ATTENDANCE_DEPARTMENT_LABELS[department as AttendanceDepartment] || department;
  if (!colors) return <span className="text-sm">{label}</span>;
  return (
    <Badge variant="outline" className={`${colors.bg} ${colors.text} border-0 font-medium`}>
      {label}
    </Badge>
  );
}

function formatTimeDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return "—";
  const totalMin = endMin - startMin;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}sa ${mins}dk`;
  return `${mins}dk`;
}

function getColumns(
  onSort: (id: string, desc: boolean) => void,
  onEdit: (record: AttendanceRow) => void,
  onDelete: (attId: string) => void
): ColumnDef<AttendanceRow>[] {
  return [
    {
      accessorKey: "tarih",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tarih" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatDate(row.original.tarih)}</span>
      ),
      size: 110,
    },
    {
      accessorKey: "employee",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Çalışan" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.employee}</span>
      ),
      size: 180,
    },
    {
      accessorKey: "department",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Departman" onSort={onSort} />
      ),
      cell: ({ row }) => <DeptBadge department={row.original.department} />,
      size: 140,
      meta: { className: "hidden sm:table-cell" },
    },
    {
      accessorKey: "start_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Giriş" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.start_time?.slice(0, 5) || "—"}
        </span>
      ),
      size: 80,
    },
    {
      accessorKey: "end_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Çıkış" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.end_time?.slice(0, 5) || "—"}
        </span>
      ),
      size: 80,
    },
    {
      id: "mesai",
      header: "Mesai",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatTimeDuration(row.original.start_time, row.original.end_time)}
        </span>
      ),
      size: 90,
      enableSorting: false,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "not_text",
      header: "Not",
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate text-sm text-muted-foreground">
          {row.original.not_text || "—"}
        </span>
      ),
      size: 150,
      enableSorting: false,
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original.att_id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 50,
      enableSorting: false,
    },
  ];
}

export function AttendanceDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  sortBy,
  sortOrder,
  onEdit,
}: AttendanceDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      return `/personel?${params.toString()}`;
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

  const handleDelete = useCallback(
    async (attId: string) => {
      if (!confirm("Bu yoklama kaydını silmek istediğinize emin misiniz?")) return;
      const result = await deleteAttendance(attId);
      if (result.success) {
        toast.success("Kayıt silindi");
      } else {
        toast.error(result.error);
      }
    },
    []
  );

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const columns = useMemo(
    () => getColumns(handleSort, onEdit, handleDelete),
    [handleSort, onEdit, handleDelete]
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
    getRowId: (row) => row.att_id,
  });

  return (
    <div className="space-y-4">
      <DataTable table={table} emptyMessage="Yoklama kaydı bulunamadı." />
      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />
    </div>
  );
}
