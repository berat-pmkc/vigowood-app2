"use client";

import { useState, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import type { IkasCustomer } from "@/lib/ikas/types";
import {
  formatTRY,
  formatIkasDateShort,
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORT_OPTIONS,
  getCustomerSegment,
  type CustomerSegmentKey,
  type CustomerSortField,
} from "@/lib/ikas/helpers";
import { MusteriDetay } from "./musteri-detay";

interface Props {
  customers: IkasCustomer[];
  totalCount: number;
  hasNext: boolean;
  currentPage: number;
  currentSearch: string;
  currentSort: CustomerSortField;
  currentDir: "asc" | "desc";
  isMock: boolean;
}

export function MusterilerClient({
  customers,
  totalCount,
  hasNext,
  currentPage,
  currentSearch,
  currentSort,
  currentDir,
  isMock,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [selectedCustomer, setSelectedCustomer] = useState<IkasCustomer | null>(null);
  const [activeSegment, setActiveSegment] = useState<CustomerSegmentKey>("all");

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

  function handleSortChange(field: CustomerSortField) {
    // If same field clicked, toggle direction
    if (field === currentSort) {
      updateParams({ dir: currentDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      updateParams({ sort: field, dir: "desc", page: "1" });
    }
  }

  function handleClear() {
    setSearch("");
    setActiveSegment("all");
    router.push("/pazaryeri/vigowood-com/musteriler");
  }

  const hasActiveFilters = currentSearch || currentSort !== "lastOrderDate" || currentDir !== "desc" || activeSegment !== "all";

  // Client-side segment filtering
  const filteredCustomers = useMemo(() => {
    if (activeSegment === "all") return customers;
    return customers.filter((c) => {
      const seg = getCustomerSegment(c.orderCount);
      return seg.key === activeSegment;
    });
  }, [customers, activeSegment]);

  // Segment counts
  const segmentCounts = useMemo(() => {
    const counts: Record<CustomerSegmentKey, number> = { all: customers.length, vip: 0, sadik: 0, aktif: 0, yeni: 0 };
    for (const c of customers) {
      const seg = getCustomerSegment(c.orderCount);
      if (seg.key !== "all") counts[seg.key]++;
    }
    return counts;
  }, [customers]);

  // Sortable column header
  function SortableHeader({ field, label }: { field: CustomerSortField; label: string }) {
    const isActive = currentSort === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 font-medium"
        onClick={() => handleSortChange(field)}
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </Button>
    );
  }

  const columns: ColumnDef<IkasCustomer>[] = [
    {
      id: "name",
      header: () => <SortableHeader field="firstName" label="Ad Soyad" />,
      cell: ({ row }) => {
        const seg = getCustomerSegment(row.original.orderCount);
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {row.original.firstName} {row.original.lastName}
            </span>
            {seg.key !== "yeni" && seg.key !== "all" && (
              <Badge className={`${seg.bg} ${seg.text} hover:${seg.bg} text-[10px] px-1.5 py-0`}>
                {seg.label}
              </Badge>
            )}
          </div>
        );
      },
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
      header: () => <SortableHeader field="orderCount" label="Sipariş" />,
      cell: ({ row }) => (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          {row.original.orderCount ?? 0}
        </Badge>
      ),
    },
    {
      id: "totalSpent",
      header: () => <SortableHeader field="totalOrderPrice" label="Toplam Harcama" />,
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.totalOrderPrice ? formatTRY(row.original.totalOrderPrice) : "-"}
        </span>
      ),
    },
    {
      id: "lastOrder",
      header: () => <SortableHeader field="lastOrderDate" label="Son Sipariş" />,
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
    data: filteredCustomers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Müşteriler</h1>
          <p className="text-sm text-muted-foreground">
            {activeSegment !== "all"
              ? `${filteredCustomers.length} / ${totalCount} müşteri`
              : `${totalCount} müşteri`}
            {isMock && " (demo veri)"}
          </p>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CUSTOMER_SEGMENTS.map((seg) => {
          const isActive = activeSegment === seg.key;
          const count = segmentCounts[seg.key];
          return (
            <Button
              key={seg.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={isActive ? "" : "text-muted-foreground"}
              onClick={() => setActiveSegment(seg.key)}
            >
              {seg.label}
              <Badge
                variant="secondary"
                className={`ml-1.5 px-1.5 py-0 text-[10px] ${
                  isActive ? "bg-white/20 text-white" : ""
                }`}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Search + Sort */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            <div className="flex gap-2">
              <Select
                value={currentSort}
                onValueChange={(v) => handleSortChange(v as CustomerSortField)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateParams({ dir: currentDir === "asc" ? "desc" : "asc", page: "1" })}
                title={currentDir === "asc" ? "Artan" : "Azalan"}
              >
                {currentDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={handleSearch}>
                Ara
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClear} title="Filtreleri temizle">
                  <X className="mr-1 h-4 w-4" />
                  Temizle
                </Button>
              )}
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
