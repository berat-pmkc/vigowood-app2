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
import { Label } from "@/components/ui/label";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { TrendyolProduct } from "@/lib/trendyol/types";
import { formatTRY } from "@/lib/trendyol/helpers";
import { updateProductStockPrice } from "../actions";

interface Props {
  products: TrendyolProduct[];
  totalElements: number;
  currentPage: number;
  currentSearch: string;
  currentApproved: string;
  currentOnSale: string;
  isMock: boolean;
}

export function UrunlerClient({
  products,
  totalElements,
  currentPage,
  currentSearch,
  currentApproved,
  currentOnSale,
  isMock,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [selectedProduct, setSelectedProduct] = useState<TrendyolProduct | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editListPrice, setEditListPrice] = useState("");
  const [saving, setSaving] = useState(false);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/pazaryeri/trendyol/urunler?${params.toString()}`);
  }

  function handleSearch() {
    updateParams({ search, page: "0" });
  }

  function openEdit(product: TrendyolProduct) {
    setSelectedProduct(product);
    setEditStock(String(product.quantity));
    setEditSalePrice(String(product.salePrice));
    setEditListPrice(String(product.listPrice));
  }

  async function handleSave() {
    if (!selectedProduct) return;
    setSaving(true);

    const result = await updateProductStockPrice([
      {
        barcode: selectedProduct.barcode,
        quantity: parseInt(editStock, 10) || undefined,
        salePrice: parseFloat(editSalePrice) || undefined,
        listPrice: parseFloat(editListPrice) || undefined,
      },
    ]);

    setSaving(false);

    if (result.success) {
      toast.success("Güncelleme isteği gönderildi");
      setSelectedProduct(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<TrendyolProduct>[] = [
    {
      accessorKey: "barcode",
      header: "Barkod",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.barcode}</span>
      ),
    },
    {
      accessorKey: "title",
      header: "Ürün Adı",
      cell: ({ row }) => (
        <span className="max-w-[250px] truncate text-sm font-medium">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "stockCode",
      header: "SKU",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.stockCode || "-"}</span>
      ),
    },
    {
      accessorKey: "salePrice",
      header: "Fiyat",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">{formatTRY(row.original.salePrice)}</p>
          {row.original.listPrice > row.original.salePrice && (
            <p className="text-xs text-muted-foreground line-through">
              {formatTRY(row.original.listPrice)}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Stok",
      cell: ({ row }) => {
        const qty = row.original.quantity;
        return (
          <Badge
            className={
              qty === 0
                ? "bg-red-100 text-red-800 hover:bg-red-100"
                : qty < 10
                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            }
          >
            {qty}
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => {
        const p = row.original;
        if (p.rejected) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Reddedildi</Badge>;
        if (!p.approved) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Beklemede</Badge>;
        if (!p.onSale) return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Satışta Değil</Badge>;
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Satışta</Badge>;
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const filterTabs = [
    { label: "Tümü", approved: "all", onSale: "all" },
    { label: "Satışta", approved: "true", onSale: "true" },
    { label: "Beklemede", approved: "false", onSale: "all" },
    { label: "Stok Yok", approved: "all", onSale: "all" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Ürünler</h1>
          <p className="text-sm text-muted-foreground">
            {totalElements} ürün {isMock && "(demo veri)"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map((tab) => {
              const isActive =
                currentApproved === tab.approved && currentOnSale === tab.onSale;
              return (
                <Button
                  key={tab.label}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateParams({
                      approved: tab.approved,
                      onSale: tab.onSale,
                      page: "0",
                    })
                  }
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı, barkod veya SKU..."
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
                      Ürün bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEdit(row.original)}
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
              Sayfa {currentPage + 1} / {Math.max(1, Math.ceil(totalElements / 50))}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => updateParams({ page: String(currentPage - 1) })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={products.length < 50}
                onClick={() => updateParams({ page: String(currentPage + 1) })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Stok & Fiyat Güncelle</SheetTitle>
          </SheetHeader>
          {selectedProduct && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedProduct.title}</p>
                <p className="text-xs text-muted-foreground">
                  Barkod: {selectedProduct.barcode} | SKU: {selectedProduct.stockCode || "-"}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="editStock">Stok Adedi</Label>
                  <Input
                    id="editStock"
                    type="number"
                    min={0}
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="editSalePrice">Satış Fiyatı (₺)</Label>
                  <Input
                    id="editSalePrice"
                    type="number"
                    step="0.01"
                    min={0}
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="editListPrice">Liste Fiyatı (₺)</Label>
                  <Input
                    id="editListPrice"
                    type="number"
                    step="0.01"
                    min={0}
                    value={editListPrice}
                    onChange={(e) => setEditListPrice(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Liste fiyatı satış fiyatından büyük veya eşit olmalıdır
                  </p>
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <RefreshCw className={`mr-2 h-4 w-4 ${saving ? "animate-spin" : ""}`} />
                {saving ? "Güncelleniyor..." : "Güncelle"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
