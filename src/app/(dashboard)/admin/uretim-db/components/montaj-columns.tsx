"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, CheckCircle2 } from "lucide-react";
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
import { MONTAJ_SESSION_STATUS_LABELS, MONTAJ_SESSION_STATUS_COLORS } from "@/lib/constants";
import type { MontajSession } from "@/lib/supabase/types";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (session: MontajSession) => void;
  onDelete: (session: MontajSession) => void;
}

export function getMontajColumns({
  onSort,
  onEdit,
  onDelete,
}: ColumnOptions): ColumnDef<MontajSession>[] {
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
        <span className="font-mono text-sm">{row.getValue("sku")}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "step_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adım" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const session = row.original;
        return (
          <span className="text-sm">
            {session.seq_no ? `${session.seq_no}. ` : ""}{session.step_name || "—"}
          </span>
        );
      },
      size: 160,
    },
    {
      accessorKey: "durum",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const durum = row.getValue("durum") as string;
        const label = MONTAJ_SESSION_STATUS_LABELS[durum as keyof typeof MONTAJ_SESSION_STATUS_LABELS] || durum;
        const colors = MONTAJ_SESSION_STATUS_COLORS[durum as keyof typeof MONTAJ_SESSION_STATUS_COLORS];
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
      accessorKey: "birim_montaj_dk",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Birim dk" onSort={onSort} className="justify-end" />
      ),
      cell: ({ row }) => {
        const val = row.getValue("birim_montaj_dk") as number | null;
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
      accessorKey: "start_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Başlama" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const val = row.getValue("start_time") as string | null;
        return (
          <span className="text-sm whitespace-nowrap">
            {val ? `${formatDate(val)} ${formatTime(val)}` : "—"}
          </span>
        );
      },
      meta: { className: "hidden xl:table-cell" },
      size: 150,
    },
    {
      accessorKey: "end_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Bitiş" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const val = row.getValue("end_time") as string | null;
        return (
          <span className="text-sm whitespace-nowrap">
            {val ? `${formatDate(val)} ${formatTime(val)}` : "—"}
          </span>
        );
      },
      meta: { className: "hidden xl:table-cell" },
      size: 150,
    },
    {
      accessorKey: "is_final_step",
      header: () => <span className="text-xs">Son</span>,
      cell: ({ row }) => {
        const isFinal = row.getValue("is_final_step") as boolean;
        return isFinal ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : null;
      },
      meta: { className: "hidden lg:table-cell" },
      size: 50,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const session = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menü</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(session)}>
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(session)}
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
