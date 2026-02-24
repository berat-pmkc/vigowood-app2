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
import type { IkasCustomer } from "@/lib/ikas/types";
import { formatTRY, formatIkasDateShort } from "@/lib/ikas/helpers";
import { MusteriDetay } from "./musteri-detay";

interface Props {
  customers: IkasCustomer[];
  totalCount: number;
  hasNext: boolean;
  currentPage: number;
  currentSearch: string;
  isMock: boolean;
}

export function MusterilerClient({
  customers,
  totalCount,
  hasNext,
  currentPage,
  currentSearch,
  isMock,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [selectedCustomer, setSelectedCustomer] = useState<IkasCustomer | null>(null);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/pazaryeri/vigowood-com/musteriler?${params.toString()}`);
  }

  function handleSearch() {
    updateParams({ search, page: "1" });
  }

  const columns: ColumnDef<IkasCustomer>[] = [
    {
      id: "name",
      header: "Ad Soyad",
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-sm">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Telefon",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.phone || "-"}</span>
      ),
    },
    {
      accessorKey: "orderCount",
      header: "Sipariş",
      cell: ({ row }) => (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          {row.original.orderCount}
        </Badge>
      ),
    },
    {
      id: "totalSpent",
      header: "Toplam Harcama",
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.totalOrderPrice ? formatTRY(row.original.totalOrderPrice) : "-"}
        </span>
      ),
    },
    {
      id: "lastOrder",
      header: "Son Sipariş",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastOrderDate
            ? formatIkasDateShort(row.original.lastOrderDate)
            : "-"}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Müşteriler</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} müşteri {isMock && "(demo veri)"}
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ad, soyad veya email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button size="sm" onClick={handleSearch}>
              Ara
            </Button>
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
                      Müşteri bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCustomer(row.original)}
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

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Müşteri Detayı</SheetTitle>
          </SheetHeader>
          {selectedCustomer && <MusteriDetay customer={selectedCustomer} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
