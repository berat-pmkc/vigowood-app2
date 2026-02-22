"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  DropdownMenuSeparator,
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
import { MoreHorizontal, Pencil, Trash2, CheckCircle2, Clock } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ODEME_DURUM_COLORS, type OdemeDurumuConst } from "@/lib/constants";
import { OdemeTuruBadge } from "./odeme-turu-badge";
import { toggleOdemeDurum, deleteOdeme } from "../actions";
import { toast } from "sonner";
import type { Odeme } from "@/lib/supabase/types";

interface OdemelerDataTableProps {
  data: Odeme[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onEdit: (record: Odeme) => void;
}

interface DurumConfirmState {
  id: string;
  tanimi: string;
  tutar: number;
  cinsi: string;
  currentDurum: string;
  newDurum: string;
}

function DurumBadge({ durum }: { durum: string | null }) {
  if (!durum) return <span className="text-muted-foreground">—</span>;
  const colors = ODEME_DURUM_COLORS[durum as OdemeDurumuConst];
  if (!colors) return <span className="text-sm">{durum}</span>;
  return (
    <Badge variant="outline" className={`${colors.bg} ${colors.text} border-0 font-medium`}>
      {durum === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
    </Badge>
  );
}

function getColumns(
  onSort: (id: string, desc: boolean) => void,
  onEdit: (record: Odeme) => void,
  onToggleDurum: (record: Odeme) => void,
  onDelete: (id: string) => void
): ColumnDef<Odeme>[] {
  return [
    {
      accessorKey: "tarih",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tarih" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatDate(row.original.tarih)}</span>
      ),
      size: 100,
    },
    {
      accessorKey: "tanimi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tanım" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[250px] truncate text-sm">{row.original.tanimi}</span>
      ),
      size: 250,
    },
    {
      accessorKey: "turu",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tür" onSort={onSort} />
      ),
      cell: ({ row }) => <OdemeTuruBadge turu={row.original.turu} />,
      size: 120,
    },
    {
      accessorKey: "tutar",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tutar" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(
            Number(row.original.tutar),
            (row.original.cinsi as "TL" | "USD" | "EUR") || "TL"
          )}
        </span>
      ),
      size: 130,
    },
    {
      accessorKey: "cinsi",
      header: "Cinsi",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.cinsi || "TL"}</span>
      ),
      size: 60,
      enableSorting: false,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "odeme_durum",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <button
          className="cursor-pointer"
          onClick={() => onToggleDurum(row.original)}
        >
          <DurumBadge durum={row.original.odeme_durum} />
        </button>
      ),
      size: 110,
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
              onClick={() => onToggleDurum(row.original)}
            >
              {row.original.odeme_durum === "TAMAMLANDI" ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Bekliyor Yap
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Tamamlandı Yap
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original.id)}
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

export function OdemelerDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  sortBy,
  sortOrder,
  onEdit,
}: OdemelerDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [durumConfirm, setDurumConfirm] = useState<DurumConfirmState | null>(null);

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
      return `/muhasebe/odemeler?${params.toString()}`;
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

  const handleRequestToggleDurum = useCallback((record: Odeme) => {
    const currentDurum = record.odeme_durum || "BEKLİYOR";
    const newDurum = currentDurum === "TAMAMLANDI" ? "BEKLİYOR" : "TAMAMLANDI";
    setDurumConfirm({
      id: record.id,
      tanimi: record.tanimi,
      tutar: Number(record.tutar),
      cinsi: record.cinsi || "TL",
      currentDurum,
      newDurum,
    });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (!durumConfirm) return;
    const result = await toggleOdemeDurum(
      durumConfirm.id,
      durumConfirm.newDurum as "TAMAMLANDI" | "BEKLİYOR"
    );
    if (result.success) {
      toast.success(
        `Durum güncellendi: ${durumConfirm.newDurum === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}`
      );
    } else {
      toast.error(result.error);
    }
    setDurumConfirm(null);
  }, [durumConfirm]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Bu ödeme kaydını silmek istediğinize emin misiniz?")) return;
    const result = await deleteOdeme(id);
    if (result.success) {
      toast.success("Ödeme silindi");
    } else {
      toast.error(result.error);
    }
  }, []);

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const columns = useMemo(
    () => getColumns(handleSort, onEdit, handleRequestToggleDurum, handleDelete),
    [handleSort, onEdit, handleRequestToggleDurum, handleDelete]
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
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-4">
      <DataTable table={table} emptyMessage="Ödeme kaydı bulunamadı." />
      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <AlertDialog
        open={!!durumConfirm}
        onOpenChange={(open) => { if (!open) setDurumConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ödeme Durumunu Değiştir</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">
                    {durumConfirm?.tanimi}
                  </span>
                </p>
                <p>
                  Tutar: {durumConfirm && formatCurrency(
                    durumConfirm.tutar,
                    durumConfirm.cinsi as "TL" | "USD" | "EUR"
                  )}
                </p>
                <p>
                  <DurumBadge durum={durumConfirm?.currentDurum ?? null} />
                  {" → "}
                  <DurumBadge durum={durumConfirm?.newDurum ?? null} />
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              Onayla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
