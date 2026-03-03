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
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { deleteKartonSablon } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface KartonSablonRow {
  plakalar_id: string;
  plaka_id: string;
  plaka_adi: string | null;
  renk: string | null;        // "İç Kutu" / "Dış Koli" (UI'da "Tür")
  en: number | null;
  boy: number | null;
  kesim_sureleri: unknown;
  sku: string[] | null;
  created_at: string;
  updated_at: string | null;
  plaka_kategori: string;
  tip_part_id: string | null;
  tip_part_adi: string | null;
}

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (row: KartonSablonRow) => void;
}

function KartonActionsCell({
  row,
  onEdit,
}: {
  row: KartonSablonRow;
  onEdit: (row: KartonSablonRow) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteKartonSablon(row.plakalar_id);
      if (result.success) {
        toast.success("Şablon silindi");
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
        <DropdownMenuTrigger
          asChild
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Menü</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row)}>
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
            <AlertDialogTitle>Şablonu Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{row.plakalar_id}</strong> şablonunu silmek istediğinize
              emin misiniz? Bu işlem geri alınamaz.
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

export function getKartonSablonColumns({
  onSort,
  onEdit,
}: ColumnOptions): ColumnDef<KartonSablonRow>[] {
  return [
    {
      accessorKey: "plakalar_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.getValue("plakalar_id")}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const skuArr = row.getValue("sku") as string[] | null;
        if (!skuArr || skuArr.length === 0) {
          return <span className="text-sm text-muted-foreground">&mdash;</span>;
        }
        return (
          <div className="flex gap-1 flex-wrap">
            {skuArr.map((sku) => {
              const style = getSkuBadgeStyle(sku);
              return (
                <Badge
                  key={sku}
                  variant="outline"
                  className="font-mono text-xs"
                  style={{
                    backgroundColor: style.backgroundColor,
                    color: style.color,
                    borderColor: style.borderColor,
                  }}
                >
                  {sku}
                </Badge>
              );
            })}
          </div>
        );
      },
      size: 180,
    },
    {
      accessorKey: "renk",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tür" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const tur = row.getValue("renk") as string | null;
        if (!tur) return <span className="text-sm text-muted-foreground">&mdash;</span>;
        return (
          <Badge
            variant="outline"
            className={
              tur === "İç Kutu"
                ? "text-xs bg-blue-50 text-blue-700 border-blue-200"
                : "text-xs bg-orange-50 text-orange-700 border-orange-200"
            }
          >
            {tur}
          </Badge>
        );
      },
      size: 110,
    },
    {
      id: "tip",
      header: "Tip",
      cell: ({ row }) => {
        const name = row.original.tip_part_adi;
        return name ? (
          <span className="text-sm truncate block max-w-[160px]">{name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
      size: 160,
    },
    {
      accessorKey: "en",
      header: "En (cm)",
      cell: ({ row }) => {
        const val = row.getValue("en") as number | null;
        return val != null ? (
          <span className="text-sm font-mono">{val}</span>
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
      size: 80,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "boy",
      header: "Boy (cm)",
      cell: ({ row }) => {
        const val = row.getValue("boy") as number | null;
        return val != null ? (
          <span className="text-sm font-mono">{val}</span>
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
      size: 80,
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "kutu_sure",
      header: "Kesim (dk)",
      cell: ({ row }) => {
        const ks = (row.original.kesim_sureleri ?? {}) as Record<string, number>;
        const val = ks["KUTU"];
        return val != null ? (
          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
            {val} dk
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
      size: 90,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <KartonActionsCell row={row.original} onEdit={onEdit} />
      ),
      size: 50,
    },
  ];
}
