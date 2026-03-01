"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatNumber } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

function getStokStatus(part: AllPart): "critical" | "warning" | "ok" {
  const stok = part.hazir_eleman_aktif_stok;
  const kritik = part.hazir_eleman_kritik_stok;
  if (kritik <= 0) return "ok";
  if (stok <= 0 || stok < kritik) return "critical";
  if (stok <= kritik * 1.5) return "warning";
  return "ok";
}

interface GetColumnsOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (part: AllPart) => void;
  onDelete: (part: AllPart) => void;
}

export function getHazirElemanColumns({
  onSort,
  onEdit,
  onDelete,
}: GetColumnsOptions): ColumnDef<AllPart>[] {
  return [
    {
      accessorKey: "part_id",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Kod"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium text-sm">
          {row.original.part_id}
        </span>
      ),
    },
    {
      accessorKey: "part_adi",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Hazır Eleman Adı"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate block">
          {row.original.part_adi || "—"}
        </span>
      ),
    },
    {
      accessorKey: "part_type",
      header: "Tür",
      cell: ({ row }) => {
        const tur = row.original.part_type;
        if (!tur) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge variant="outline" className="text-xs">
            {tur}
          </Badge>
        );
      },
    },
    {
      accessorKey: "hazir_eleman_aktif_stok",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Stok"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => {
        const status = getStokStatus(row.original);
        return (
          <span
            className={`font-mono font-medium ${
              status === "critical"
                ? "text-vw-error"
                : status === "warning"
                  ? "text-vw-warning"
                  : ""
            }`}
          >
            {formatNumber(row.original.hazir_eleman_aktif_stok)}
          </span>
        );
      },
    },
    {
      accessorKey: "hazir_eleman_kritik_stok",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Kritik Stok"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {formatNumber(row.original.hazir_eleman_kritik_stok)}
        </span>
      ),
    },
    {
      id: "durum",
      header: "Durum",
      cell: ({ row }) => {
        const status = getStokStatus(row.original);
        if (row.original.hazir_eleman_kritik_stok <= 0) {
          return (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              —
            </Badge>
          );
        }
        if (status === "critical") {
          return (
            <Badge className="bg-vw-error/20 text-vw-error border-vw-error/30 text-xs">
              Kritik
            </Badge>
          );
        }
        if (status === "warning") {
          return (
            <Badge className="bg-vw-warning/20 text-vw-warning border-vw-warning/30 text-xs">
              Düşük
            </Badge>
          );
        }
        return (
          <Badge className="bg-vw-success/20 text-vw-success border-vw-success/30 text-xs">
            Yeterli
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row.original);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row.original);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
