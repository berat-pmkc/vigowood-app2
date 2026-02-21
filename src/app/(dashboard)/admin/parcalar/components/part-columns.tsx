"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { PART_TYPE_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { deletePart } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Database, PartType } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (part: AllPart) => void;
}

/** Get the relevant stock value based on part type */
function getStok(part: AllPart): number {
  return part.part_type === "YARIMAMUL"
    ? part.yari_mamul_stok
    : part.hazir_eleman_aktif_stok;
}

/** Get stock status: "critical" | "warning" | "ok" */
function getStokStatus(part: AllPart): "critical" | "warning" | "ok" {
  const stok = getStok(part);
  const kritik = part.hazir_eleman_kritik_stok;

  if (kritik <= 0) return "ok";
  if (stok <= 0 || stok < kritik) return "critical";
  if (stok <= kritik * 1.5) return "warning";
  return "ok";
}

const typeBadgeColors: Record<PartType, string> = {
  YARIMAMUL: "bg-blue-100 text-blue-800 border-blue-200",
  HAZIR: "bg-emerald-100 text-emerald-800 border-emerald-200",
  KUTU: "bg-amber-100 text-amber-800 border-amber-200",
  KARTON: "bg-purple-100 text-purple-800 border-purple-200",
};

function PartActionsCell({
  part,
  onEdit,
}: {
  part: AllPart;
  onEdit: (part: AllPart) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePart(part.part_id);
      if (result.success) {
        toast.success("Parça silindi");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Menü</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(part)}>
            Düzenle
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Parçayı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{part.part_id}</strong> — {part.part_adi || "İsimsiz"}{" "}
              parçasını silmek istediğinize emin misiniz? Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function getPartColumns({
  onSort,
  onEdit,
}: ColumnOptions): ColumnDef<AllPart>[] {
  return [
    {
      accessorKey: "part_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parça ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("part_id")}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "part_adi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parça Adı" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block sm:max-w-none">
          {row.getValue("part_adi") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "part_type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tip" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const type = row.getValue("part_type") as PartType;
        return (
          <Badge
            variant="outline"
            className={`text-xs whitespace-nowrap ${typeBadgeColors[type] || ""}`}
          >
            {PART_TYPE_LABELS[type] || type}
          </Badge>
        );
      },
      size: 130,
    },
    {
      id: "stok",
      accessorFn: (row) => getStok(row),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Stok"
          onSort={(id, desc) => {
            onSort("hazir_eleman_aktif_stok", desc);
          }}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const part = row.original;
        const stok = getStok(part);
        const status = getStokStatus(part);
        return (
          <div
            className={`text-right font-mono text-sm ${
              status === "critical"
                ? "text-vw-error font-semibold"
                : status === "warning"
                  ? "text-vw-warning font-semibold"
                  : ""
            }`}
          >
            {formatNumber(stok)}
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: "hazir_eleman_kritik_stok",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Kritik Seviye"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const kritik = row.getValue("hazir_eleman_kritik_stok") as number;
        return (
          <div className="text-right font-mono text-sm">
            {kritik > 0 ? formatNumber(kritik) : "—"}
          </div>
        );
      },
      meta: { className: "hidden sm:table-cell" },
      size: 110,
    },
    {
      id: "durum",
      header: "Durum",
      cell: ({ row }) => {
        const part = row.original;
        const status = getStokStatus(part);

        if (part.hazir_eleman_kritik_stok <= 0) {
          return (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              —
            </Badge>
          );
        }

        if (status === "critical") {
          return (
            <Badge className="bg-vw-error/20 text-vw-error hover:bg-vw-error/30 border-vw-error/30 text-xs">
              Kritik
            </Badge>
          );
        }
        if (status === "warning") {
          return (
            <Badge className="bg-vw-warning/20 text-vw-warning hover:bg-vw-warning/30 border-vw-warning/30 text-xs">
              Düşük
            </Badge>
          );
        }
        return (
          <Badge className="bg-vw-success/20 text-vw-success hover:bg-vw-success/30 border-vw-success/30 text-xs">
            Yeterli
          </Badge>
        );
      },
      enableSorting: false,
      size: 90,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const part = row.original;
        return <PartActionsCell part={part} onEdit={onEdit} />;
      },
      size: 50,
    },
  ];
}
