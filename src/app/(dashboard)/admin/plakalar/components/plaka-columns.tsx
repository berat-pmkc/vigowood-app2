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
import { MAKINE_LABELS } from "@/lib/constants";
import { deletePlaka } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import type { MakineId } from "@/lib/constants";

type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (plaka: Plaka) => void;
}

const makineBadgeColors: Record<string, string> = {
  BÜYÜK: "bg-blue-100 text-blue-800 border-blue-200",
  KÜÇÜK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  KUTU: "bg-amber-100 text-amber-800 border-amber-200",
};

function PlakaActionsCell({
  plaka,
  onEdit,
}: {
  plaka: Plaka;
  onEdit: (plaka: Plaka) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePlaka(plaka.plakalar_id);
      if (result.success) {
        toast.success("Plaka silindi");
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
          <DropdownMenuItem onClick={() => onEdit(plaka)}>
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
            <AlertDialogTitle>Plakayı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{plaka.plakalar_id}</strong> — {plaka.plaka_adi || "İsimsiz"}{" "}
              plakasını silmek istediğinize emin misiniz? Plaka parçaları da
              silinecektir. Bu işlem geri alınamaz.
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

export function getPlakaColumns({
  onSort,
  onEdit,
}: ColumnOptions): ColumnDef<Plaka>[] {
  return [
    {
      accessorKey: "plakalar_id",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Plaka ID"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.getValue("plakalar_id")}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: "plaka_adi",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Plaka Adı"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="max-w-[180px] truncate block sm:max-w-none">
          {row.getValue("plaka_adi") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "tipi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tip" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const tipi = row.getValue("tipi") as string | null;
        return (
          <span className="text-sm whitespace-nowrap">{tipi || "—"}</span>
        );
      },
      size: 100,
    },
    {
      accessorKey: "renk",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Renk" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const renk = row.getValue("renk") as string | null;
        return renk ? (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {renk}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
      size: 100,
    },
    {
      accessorKey: "makine_id",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Makine"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => {
        const makineId = row.getValue("makine_id") as string;
        return (
          <Badge
            variant="outline"
            className={`text-xs whitespace-nowrap ${makineBadgeColors[makineId] || ""}`}
          >
            {MAKINE_LABELS[makineId as MakineId] || makineId}
          </Badge>
        );
      },
      size: 160,
    },
    {
      accessorKey: "std_kesim_suresi_dk",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Kesim Süresi"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const sure = row.getValue("std_kesim_suresi_dk") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {sure != null ? `${sure} dk` : "—"}
          </div>
        );
      },
      size: 110,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const sku = row.getValue("sku") as string | null;
        return sku ? (
          <span className="font-mono text-xs">{sku}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
      size: 140,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const plaka = row.original;
        return <PlakaActionsCell plaka={plaka} onEdit={onEdit} />;
      },
      size: 50,
    },
  ];
}
