"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import type { ShipmentCountry } from "@/lib/shipment-settings-types";
import type { FiyatRow } from "../actions";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (fiyat: FiyatRow) => void;
  onDelete: (fiyat: FiyatRow) => void;
  ulkeler: ShipmentCountry[];
}

export function getFiyatColumns({
  onSort,
  onEdit,
  onDelete,
  ulkeler,
}: ColumnOptions): ColumnDef<FiyatRow>[] {
  const countryMap = Object.fromEntries(ulkeler.map((c) => [c.code, c]));
  return [
    {
      accessorKey: "country_code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ülke" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const code = row.getValue("country_code") as string;
        return (
          <Badge variant="outline" className="text-xs font-mono">
            {countryMap[code]?.code ?? code}
          </Badge>
        );
      },
      size: 80,
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
      accessorKey: "urun_adi_en",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün Adı (EN)" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block sm:max-w-none">
          {(row.getValue("urun_adi_en") as string) || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "gtip",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="GTIP" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const gtip = row.getValue("gtip") as string | null;
        return gtip ? (
          <span className="font-mono text-xs">{gtip}</span>
        ) : (
          "\u2014"
        );
      },
      size: 160,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "birim_fiyat",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Fiyat"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const fiyat = row.getValue("birim_fiyat") as number;
        const code = row.original.country_code;
        const symbol = countryMap[code]?.currencySymbol ?? "$";
        return (
          <div className="text-right font-mono text-sm font-semibold">
            {symbol}{fiyat.toFixed(2)}
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: "kategori",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kategori" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const kategori = row.getValue("kategori") as string | null;
        return kategori ? (
          <Badge variant="secondary" className="text-xs">
            {kategori}
          </Badge>
        ) : (
          "\u2014"
        );
      },
      size: 120,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const fiyat = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(fiyat)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(fiyat)}
                className="text-destructive"
              >
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 50,
    },
  ];
}
