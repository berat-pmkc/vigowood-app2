"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatNumber } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}

export function getProductColumns({
  onSort,
  onEdit,
  onToggleActive,
}: ColumnOptions): ColumnDef<Product>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tümünü seç"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Satır seç"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("sku")}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "urun_adi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün Adı" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block sm:max-w-none">
          {row.getValue("urun_adi") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "kategori",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kategori" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const kategori = row.getValue("kategori") as string | null;
        if (!kategori) return "—";
        return (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {kategori}
          </Badge>
        );
      },
      meta: { className: "hidden md:table-cell" },
      size: 160,
    },
    {
      accessorKey: "aktif_mi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const aktif = row.getValue("aktif_mi") as boolean;
        return (
          <Badge
            variant={aktif ? "default" : "secondary"}
            className={
              aktif
                ? "bg-vw-success/20 text-vw-success hover:bg-vw-success/30 border-vw-success/30"
                : "bg-vw-error/20 text-vw-error hover:bg-vw-error/30 border-vw-error/30"
            }
          >
            {aktif ? "Aktif" : "Pasif"}
          </Badge>
        );
      },
      size: 90,
    },
    {
      accessorKey: "stok_aktif",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Stok"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const stok = row.getValue("stok_aktif") as number;
        return (
          <div className={`text-right font-mono text-sm ${stok < 0 ? "text-vw-error font-semibold" : ""}`}>
            {formatNumber(stok)}
          </div>
        );
      },
      size: 90,
    },
    {
      accessorKey: "gunluk_satis",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Günlük Satış"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("gunluk_satis") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? val.toFixed(2).replace(".", ",") : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 110,
    },
    {
      accessorKey: "aylik_uretim",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Aylık Üretim"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {formatNumber(row.getValue("aylik_uretim"))}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 110,
    },
    {
      accessorKey: "kutu_boy_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Boy (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_boy_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      accessorKey: "kutu_en_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="En (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_en_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      accessorKey: "kutu_yukseklik_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Yükseklik (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_yukseklik_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 100,
    },
    {
      accessorKey: "urun_agirlik_kg",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Ağırlık (kg)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("urun_agirlik_kg") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? val.toFixed(2) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 90,
    },
    {
      accessorKey: "desi",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Desi"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const desi = row.getValue("desi") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {desi != null ? desi.toFixed(2) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(product)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(product)}>
                {product.aktif_mi ? "Pasif Yap" : "Aktif Yap"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 50,
    },
  ];
}
