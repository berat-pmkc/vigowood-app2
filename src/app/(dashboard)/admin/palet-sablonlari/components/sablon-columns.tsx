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
import { SEVKIYAT_COUNTRIES, type SevkiyatCountryCode } from "@/lib/constants";
import type { PaletSablonRow } from "../actions";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (sablon: PaletSablonRow) => void;
  onDelete: (sablon: PaletSablonRow) => void;
}

export function getSablonColumns({
  onSort,
  onEdit,
  onDelete,
}: ColumnOptions): ColumnDef<PaletSablonRow>[] {
  return [
    {
      accessorKey: "country_code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ülke" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const code = row.getValue("country_code") as string;
        const country = SEVKIYAT_COUNTRIES[code as SevkiyatCountryCode];
        return (
          <Badge variant="outline" className="text-xs font-mono">
            {country?.code ?? code}
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
      size: 130,
    },
    {
      accessorKey: "urun_adi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[160px] truncate block sm:max-w-none">
          {(row.getValue("urun_adi") as string) || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "palet_boyut",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Palet" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const boyut = row.getValue("palet_boyut") as string;
        const yukseklik = row.original.palet_yukseklik;
        return (
          <div className="text-xs">
            <span className="font-mono font-medium">{boyut}</span>
            <span className="text-muted-foreground ml-1">h:{yukseklik}cm</span>
          </div>
        );
      },
      size: 130,
    },
    {
      id: "koli_boyut",
      header: "Koli (cm)",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.en}×{row.original.boy}×{row.original.yuk}
        </span>
      ),
      size: 110,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "palette_koli",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Koli/Plt"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm tabular-nums">
          {row.getValue("palette_koli")}
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: "koli_adedi",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Adet/Koli"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm tabular-nums">
          {row.getValue("koli_adedi")}
        </div>
      ),
      size: 90,
    },
    {
      accessorKey: "koli_agirlik",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="kg/Koli"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm tabular-nums">
          {(row.getValue("koli_agirlik") as number).toFixed(1)}
        </div>
      ),
      size: 80,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const sablon = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(sablon)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(sablon)}
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
