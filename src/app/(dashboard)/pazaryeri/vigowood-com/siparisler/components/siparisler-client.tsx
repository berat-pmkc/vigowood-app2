"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { IkasOrder } from "@/lib/ikas/types";
import {
  ORDER_TAB_FILTERS,
  formatIkasDate,
  formatTRY,
  getCustomerName,
  getOrderProductSummary,
  getDisplayStatus,
} from "@/lib/ikas/helpers";
import { SiparisDetay } from "./siparis-detay";

interface Props {
  orders: IkasOrder[];
  totalCount: number;
  hasNext: boolean;
  currentPage: number;
  currentStatus: string;
  currentSearch: string;
  startDate: string;
  endDate: string;
  isMock: boolean;
}

export function SiparislerClient({
  orders,
  totalCount,
  hasNext,
  currentPage,
  currentStatus,
  currentSearch,
  startDate,
  endDate,
  isMock,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [selectedOrder, setSelectedOrder] = useState<IkasOrder | null>(null);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/pazaryeri/vigowood-com/siparisler?${params.toString()}`);
  }

  function handleSearch() {
    updateParams({ search, page: "1" });
  }

  const columns: ColumnDef<IkasOrder>[] = [
    {
      accessorKey: "orderNumber",
      header: "Sipariş No",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: "orderedAt",
      header: "Tarih",
      cell: ({ row }) => (
        <span className="text-sm">{formatIkasDate(row.original.orderedAt)}</span>
      ),
    },
    {
      id: "customer",
      header: "Müşteri",
      cell: ({ row }) => (
        <span className="text-sm">{getCustomerName(row.original)}</span>
      ),
    },
    {
      id: "products",
      header: "Ürünler",
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-sm">
          {getOrderProductSummary(row.original)}
        </span>
      ),
    },
    {
      accessorKey: "totalFinalPrice",
      header: "Tutar",
      cell: ({ row }) => (
        <span className="font-medium">{formatTRY(row.original.totalFinalPrice)}</span>
      ),
    },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => {
        const { label, bg, text } = getDisplayStatus(row.original);
        return (
          <Badge className={`${bg} ${text} hover:${bg}`}>
            {label}
          </Badge>
        );
      },
    },
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Siparişler</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} sipariş {isMock && "(demo veri)"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1">
            {ORDER_TAB_FILTERS.map((tab) => (
              <Button
                key={tab.packageStatus}
                variant={currentStatus === tab.packageStatus ? "default" : "outline"}
                size="sm"
                onClick={() => updateParams({ status: tab.packageStatus === "all" ? "" : tab.packageStatus, page: "1" })}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Search + Date */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sipariş no veya müşteri adı..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="w-[150px]"
                value={startDate}
                onChange={(e) => updateParams({ startDate: e.target.value, page: "1" })}
              />
              <Input
                type="date"
                className="w-[150px]"
                value={endDate}
                onChange={(e) => updateParams({ endDate: e.target.value, page: "1" })}
              />
              <Button size="sm" onClick={handleSearch}>
                Ara
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                      Sipariş bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedOrder(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Sayfa {currentPage} {hasNext && "/ ..."}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => updateParams({ page: String(currentPage - 1) })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => updateParams({ page: String(currentPage + 1) })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sipariş Detayı</SheetTitle>
          </SheetHeader>
          {selectedOrder && <SiparisDetay order={selectedOrder} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
