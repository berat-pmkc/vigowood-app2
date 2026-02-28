"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { SyncStatus } from "../../components/sync-status";
import type { TrendyolClaim, TrendyolClaimStatus } from "@/lib/trendyol/types";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  CLAIM_TAB_FILTERS,
  formatTrendyolDate,
} from "@/lib/trendyol/helpers";

interface Props {
  claims: TrendyolClaim[];
  totalElements: number;
  currentPage: number;
  currentStatus: string;
  currentSearch: string;
  startDate: string;
  endDate: string;
  lastSyncAt: string | null;
}

export function IadelerClient({
  claims,
  totalElements,
  currentPage,
  currentStatus,
  currentSearch,
  startDate,
  endDate,
  lastSyncAt,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(totalElements / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      status: currentStatus !== "all" ? currentStatus : undefined,
      search: currentSearch || undefined,
      page: currentPage > 0 ? String(currentPage) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    return `/pazaryeri/trendyol/iadeler${params.toString() ? `?${params}` : ""}`;
  }

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const val = (form.elements.namedItem("search") as HTMLInputElement).value.trim();
      router.push(buildUrl({ search: val, page: undefined }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStatus, startDate, endDate]
  );

  // Claim durumuna göre badge rengi
  function statusBadge(status: TrendyolClaimStatus) {
    const label = CLAIM_STATUS_LABELS[status] || status;
    const colors = CLAIM_STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-800" };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
        {label}
      </span>
    );
  }

  const columns: ColumnDef<TrendyolClaim>[] = [
    {
      accessorKey: "id",
      header: "Talep No",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px] block" title={row.original.id}>
          {row.original.id.slice(-10)}
        </span>
      ),
    },
    {
      accessorKey: "orderNumber",
      header: "Sipariş No",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ getValue }) => statusBadge(getValue() as TrendyolClaimStatus),
    },
    {
      accessorKey: "claimDate",
      header: "Talep Tarihi",
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">
          {formatTrendyolDate(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: "items",
      header: "Ürün Sayısı",
      cell: ({ getValue }) => {
        const items = getValue() as TrendyolClaim["items"];
        return (
          <div className="flex items-center gap-1 text-xs">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{items?.length || 0} ürün</span>
          </div>
        );
      },
    },
    {
      id: "urun_detay",
      header: "İade Ürünleri",
      cell: ({ row }) => {
        const items = row.original.items || [];
        if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="space-y-0.5 max-w-[200px]">
            {items.slice(0, 2).map((item, i) => (
              <div key={i} className="text-xs text-muted-foreground truncate" title={item.productName}>
                {item.productName || item.barcode || item.id}
                {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </div>
            ))}
            {items.length > 2 && (
              <span className="text-xs text-muted-foreground">+{items.length - 2} daha</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "cargoTrackingNumber",
      header: "İade Kargo No",
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined;
        return v ? (
          <span className="font-mono text-xs">{v}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ];

  const table = useReactTable({
    data: claims,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">İade Talepleri</h1>
          <p className="text-xs text-muted-foreground">
            {totalElements} talep
          </p>
        </div>
        <SyncStatus lastSyncAt={lastSyncAt} />
      </div>

      {/* Tab Filters */}
      <div className="flex flex-wrap gap-1.5">
        {CLAIM_TAB_FILTERS.map((f) => (
          <button
            key={f.status}
            onClick={() => router.push(buildUrl({ status: f.status === "all" ? undefined : f.status, page: undefined }))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              currentStatus === f.status || (f.status === "all" && currentStatus === "all")
                ? "bg-vw-dark text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + Date filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              defaultValue={currentSearch}
              placeholder="Sipariş no / talep no"
              className="pl-8 h-9 w-52 text-sm"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Ara
          </Button>
        </form>
        <Input
          type="date"
          defaultValue={startDate}
          className="h-9 w-36 text-sm"
          onChange={(e) => router.push(buildUrl({ startDate: e.target.value, page: undefined }))}
        />
        <Input
          type="date"
          defaultValue={endDate}
          className="h-9 w-36 text-sm"
          onChange={(e) => router.push(buildUrl({ endDate: e.target.value, page: undefined }))}
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            İade Talepleri
            {currentStatus !== "all" && (
              <span className="ml-2 text-muted-foreground font-normal">
                — {CLAIM_STATUS_LABELS[currentStatus as TrendyolClaimStatus] || currentStatus}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="first:pl-4 last:pr-4">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Bu dönemde iade talebi bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="first:pl-4 last:pr-4 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalElements)} / {totalElements}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 0}
              onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages - 1}
              onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
