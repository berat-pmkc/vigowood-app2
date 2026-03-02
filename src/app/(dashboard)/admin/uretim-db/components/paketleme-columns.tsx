"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
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
import { PACK_STATUS_LABELS, PACK_STATUS_COLORS } from "@/lib/constants";
import type { PackEvent } from "@/lib/supabase/types";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (event: PackEvent) => void;
  onDelete: (event: PackEvent) => void;
}

export function getPaketlemeColumns({
  onSort,
  onEdit,
  onDelete,
}: ColumnOptions): ColumnDef<PackEvent>[] {
  return [
    {
      accessorKey: "session_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Seans ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("session_id")}</span>
      ),
      size: 180,
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
      accessorKey: "durum",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const durum = row.getValue("durum") as string;
        const label = PACK_STATUS_LABELS[durum as keyof typeof PACK_STATUS_LABELS] || durum;
        const colors = PACK_STATUS_COLORS[durum as keyof typeof PACK_STATUS_COLORS];
        return (
          <Badge
            variant="outline"
            className={`text-xs whitespace-nowrap ${colors ? `${colors.bg} ${colors.text} ${colors.border}` : ""}`}
          >
            {label}
          </Badge>
        );
      },
      size: 120,
    },
    {
      accessorKey: "operator_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Operatör" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("operator_name") || "—"}</span>
      ),
      meta: { className: "hidden md:table-cell" },
      size: 130,
    },
    {
      accessorKey: "qty",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adet" onSort={onSort} className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {formatNumber(Number(row.getValue("qty")))}
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: "worker_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kişi" onSort={onSort} className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue("worker_count") ?? "—"}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 70,
    },
    {
      accessorKey: "birim_paketleme_dk",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Birim dk" onSort={onSort} className="justify-end" />
      ),
      cell: ({ row }) => {
        const val = row.getValue("birim_paketleme_dk") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? `${val} dk` : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 90,
    },
    {
      accessorKey: "tarih",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tarih" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDate(row.getValue("tarih"))}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: "start_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Başlama" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatTime(row.getValue("start_time"))}
        </span>
      ),
      meta: { className: "hidden xl:table-cell" },
      size: 80,
    },
    {
      accessorKey: "end_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Bitiş" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatTime(row.getValue("end_time"))}
        </span>
      ),
      meta: { className: "hidden xl:table-cell" },
      size: 80,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const event = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(event)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(event)}
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
