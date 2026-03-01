"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { MappingEditSheet } from "./mapping-edit-sheet";
import { getSkuMappings, deleteSkuMapping } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

type SkuMapping = Database["public"]["Tables"]["sku_mappings"]["Row"];

const CHANNEL_BADGES: Record<string, { label: string; className: string }> = {
  trendyol: {
    label: "Trendyol",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  ikas: {
    label: "İkas",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  matched: {
    label: "Eşleşti",
    className: "bg-vw-success/20 text-vw-success border-vw-success/30",
  },
  unmatched: {
    label: "Eşleşmedi",
    className: "bg-vw-error/20 text-vw-error border-vw-error/30",
  },
};

export function MappingsTab() {
  const [data, setData] = useState<SkuMapping[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit / Delete state
  const [editMapping, setEditMapping] = useState<SkuMapping | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setIsLoading(true);
    startTransition(async () => {
      try {
        const result = await getSkuMappings({
          channel: channel || undefined,
          search: search || undefined,
          page: pageIndex,
          pageSize,
          sortBy,
          sortOrder,
        });
        setData(result.data);
        setTotalCount(result.count);
      } catch {
        toast.error("Veriler yüklenirken hata oluştu");
      } finally {
        setIsLoading(false);
      }
    });
  }, [channel, search, pageIndex, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      setSortBy(columnId);
      setSortOrder(desc ? "desc" : "asc");
      setPageIndex(0);
    },
    []
  );

  const handleEdit = useCallback((mapping: SkuMapping) => {
    setEditMapping(mapping);
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditMapping(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    const result = await deleteSkuMapping(deleteId);
    if (result.success) {
      toast.success("Eşleştirme silindi");
      setDeleteId(null);
      fetchData();
    } else {
      toast.error(result.error);
    }
  }, [deleteId, fetchData]);

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const columns: ColumnDef<SkuMapping>[] = useMemo(
    () => [
      {
        accessorKey: "master_sku",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Master SKU" onSort={handleSort} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">
            {row.getValue("master_sku")}
          </span>
        ),
        size: 130,
      },
      {
        accessorKey: "channel",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Kanal" onSort={handleSort} />
        ),
        cell: ({ row }) => {
          const ch = row.getValue("channel") as string;
          const badge = CHANNEL_BADGES[ch];
          return badge ? (
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          ) : (
            <Badge variant="outline">{ch}</Badge>
          );
        },
        size: 100,
      },
      {
        accessorKey: "channel_sku",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Kanal SKU" onSort={handleSort} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {(row.getValue("channel_sku") as string) || "—"}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "channel_barcode",
        header: "Barkod",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {(row.getValue("channel_barcode") as string) || "—"}
          </span>
        ),
        meta: { className: "hidden lg:table-cell" },
        size: 140,
        enableSorting: false,
      },
      {
        accessorKey: "channel_product_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Ürün Adı" onSort={handleSort} />
        ),
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate block text-sm">
            {(row.getValue("channel_product_name") as string) || "—"}
          </span>
        ),
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "match_method",
        header: "Eşleşme",
        cell: ({ row }) => {
          const method = row.getValue("match_method") as string | null;
          if (!method) return "—";
          return (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {method}
            </span>
          );
        },
        meta: { className: "hidden xl:table-cell" },
        size: 140,
        enableSorting: false,
      },
      {
        accessorKey: "match_status",
        header: "Durum",
        cell: ({ row }) => {
          const status = row.getValue("match_status") as string;
          const badge = STATUS_BADGES[status];
          return badge ? (
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          ) : (
            <Badge variant="outline">{status}</Badge>
          );
        },
        size: 90,
        enableSorting: false,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const mapping = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Menü</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(mapping)}>
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteId(mapping.id)}
                >
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        size: 50,
      },
    ],
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
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SKU veya ürün adı ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={channel || "all"}
            onValueChange={(v) => {
              setChannel(v === "all" ? "" : v);
              setPageIndex(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Kanal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kanallar</SelectItem>
              <SelectItem value="trendyol">Trendyol</SelectItem>
              <SelectItem value="ikas">İkas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} size="sm" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Eşleştirme
        </Button>
      </div>

      {/* Table */}
      {isLoading && data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Yükleniyor...
        </div>
      ) : (
        <>
          <DataTable
            table={table}
            onRowClick={handleEdit}
            emptyMessage="Eşleştirme bulunamadı."
          />
          <DataTablePagination
            table={table}
            totalCount={totalCount}
            onPageChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
          />
        </>
      )}

      {/* Edit Sheet */}
      <MappingEditSheet
        mapping={editMapping}
        mode={sheetMode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={fetchData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eşleştirmeyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu eşleştirme kalıcı olarak silinecek. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
