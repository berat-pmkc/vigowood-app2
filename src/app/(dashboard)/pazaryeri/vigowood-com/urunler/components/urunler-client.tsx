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
import type { IkasProduct } from "@/lib/ikas/types";
import { formatTRY, getProductPrice, getProductSku } from "@/lib/ikas/helpers";
import { updateProductStock } from "../actions";

interface Props {
  products: IkasProduct[];
  totalCount: number;
  hasNext: boolean;
  currentPage: number;
  currentSearch: string;
  currentFilter: string;
  isMock: boolean;
}

export function UrunlerClient({
  products,
  totalCount,
  hasNext,
  currentPage,
  currentSearch,
  currentFilter,
  isMock,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [selectedProduct, setSelectedProduct] = useState<IkasProduct | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
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
    router.push(`/pazaryeri/vigowood-com/urunler?${params.toString()}`);
  }

  function handleSearch() {
    updateParams({ search, page: "1" });
  }

  function openEdit(product: IkasProduct) {
    setSelectedProduct(product);
    setEditStock(String(product.totalStock));
    setEditSalePrice(String(getProductPrice(product)));
  }

  async function handleSave() {
    if (!selectedProduct || !selectedProduct.variants[0]) return;
    setSaving(true);

    const variant = selectedProduct.variants[0];
    const result = await updateProductStock([
      {
        productId: selectedProduct.id,
        variantId: variant.id,
        stockLocationId: "6a673a0f-ef7c-4d43-8860-2a62362ce16c", // Ana Depo
        stockCount: parseInt(editStock, 10) || 0,
      },
    ]);

    setSaving(false);

    if (result.success) {
      toast.success("Stok güncelleme isteği gönderildi");
      setSelectedProduct(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const filterTabs = [
    { label: "Tümü", filter: "all" },
    { label: "Aktif", filter: "active" },
    { label: "Stok Yok", filter: "outofstock" },
  ];

  const columns: ColumnDef<IkasProduct>[] = [
    {
      id: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{getProductSku(row.original)}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Ürün Adı",
      cell: ({ row }) => (
        <span className="max-w-[250px] truncate text-sm font-medium">
          {row.original.name}
        </span>
      ),
    },
    {
      id: "price",
      header: "Fiyat",
      cell: ({ row }) => {
        const price = getProductPrice(row.original);
        return <span className="text-sm font-medium">{formatTRY(price)}</span>;
      },
    },
    {
      accessorKey: "totalStock",
      header: "Stok",
      cell: ({ row }) => {
        const stock = row.original.totalStock;
        return (
          <Badge
            className={
              stock === 0
                ? "bg-red-100 text-red-800 hover:bg-red-100"
                : stock < 10
                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            }
          >
            {stock}
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => {
        const hasActive = row.original.variants.some((v) => v.isActive);
        const stock = row.original.totalStock;
        if (stock === 0)
          return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Stok Yok</Badge>;
        if (!hasActive)
          return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Pasif</Badge>;
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aktif</Badge>;
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Ürünler</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} ürün {isMock && "(demo veri)"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map((tab) => (
              <Button
                key={tab.filter}
                variant={currentFilter === tab.filter ? "default" : "outline"}
                size="sm"
                onClick={() => updateParams({ filter: tab.filter, page: "1" })}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı veya SKU..."
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

      {/* Edit Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Stok & Fiyat Güncelle</SheetTitle>
          </SheetHeader>
          {selectedProduct && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground">
                  SKU: {getProductSku(selectedProduct)} | Mevcut Stok: {selectedProduct.totalStock}
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
                  <Label htmlFor="editSalePrice">Satış Fiyatı (TL)</Label>
                  <Input
                    id="editSalePrice"
                    type="number"
                    step="0.01"
                    min={0}
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                  />
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <RefreshCw className={`mr-2 h-4 w-4 ${saving ? "animate-spin" : ""}`} />
                {saving ? "Güncelleniyor..." : "Stok Güncelle"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
