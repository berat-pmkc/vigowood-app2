"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatDate, formatTime, formatNumber } from "@/lib/utils";
import { CUT_STATUS_LABELS, CUT_STATUS_COLORS } from "@/lib/constants";
import type { CutBatch } from "@/lib/supabase/types";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (batch: CutBatch) => void;
  onDelete: (batch: CutBatch) => void;
  expandedRows: Record<string, boolean>;
  onToggleExpand: (cutId: string) => void;
}

export function getKesimColumns({
  onSort,
  onEdit,
  onDelete,
  expandedRows,
  onToggleExpand,
}: ColumnOptions): ColumnDef<CutBatch>[] {
  return [
    {
      id: "expand",
      header: () => null,
      cell: ({ row }) => {
        const isExpanded = expandedRows[row.original.cut_id];
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(row.original.cut_id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        );
      },
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: "cut_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kesim ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("cut_id")}</span>
      ),
      size: 120,
    },
    {
      accessorKey: "tarih",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tarih" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">{formatDate(row.getValue("tarih"))}</span>
      ),
      size: 110,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("sku") || "—"}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "plaka_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Plaka" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("plaka_id") || "—"}</span>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 120,
    },
    {
      accessorKey: "makine_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Makine" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const makine = row.getValue("makine_id") as string | null;
        if (!makine) return "—";
        return (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {makine}
          </Badge>
        );
      },
      meta: { className: "hidden md:table-cell" },
      size: 100,
    },
    {
      accessorKey: "adet",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adet" onSort={onSort} className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {formatNumber(row.getValue("adet") as number)}
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: "operator_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Operatör" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("operator_id") || "—"}</span>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 100,
    },
    {
      accessorKey: "durum",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const durum = row.getValue("durum") as string;
        const label = CUT_STATUS_LABELS[durum as keyof typeof CUT_STATUS_LABELS] || durum;
        const colors = CUT_STATUS_COLORS[durum as keyof typeof CUT_STATUS_COLORS];
        return (
          <Badge
            variant="outline"
            className={`text-xs whitespace-nowrap ${colors ? `${colors.bg} ${colors.text} ${colors.border}` : ""}`}
          >
            {label}
          </Badge>
        );
      },
      size: 110,
    },
    {
      accessorKey: "baslama_zamani",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Başlama" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatTime(row.getValue("baslama_zamani"))}
        </span>
      ),
      meta: { className: "hidden xl:table-cell" },
      size: 80,
    },
    {
      accessorKey: "bitis_zamani",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Bitiş" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatTime(row.getValue("bitis_zamani"))}
        </span>
      ),
      meta: { className: "hidden xl:table-cell" },
      size: 80,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const batch = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(batch)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(batch)}
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
