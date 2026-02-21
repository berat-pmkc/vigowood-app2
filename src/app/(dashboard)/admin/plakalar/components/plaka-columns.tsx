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
import { deletePlaka } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/types";

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

function KesimSureleriCell({ kesimSureleri }: { kesimSureleri: unknown }) {
  const ks = (kesimSureleri ?? {}) as Record<string, number>;
  const entries = Object.entries(ks);

  if (entries.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const labels: Record<string, string> = {
    BÜYÜK: "B",
    KÜÇÜK: "K",
    KUTU: "KU",
  };

  return (
    <div className="flex gap-1.5 flex-wrap">
      {(["BÜYÜK", "KÜÇÜK", "KUTU"] as const).map((key) => {
        const val = ks[key];
        if (val == null) return null;
        return (
          <Badge
            key={key}
            variant="outline"
            className={`text-xs px-1.5 py-0 ${makineBadgeColors[key] || ""}`}
          >
            {labels[key]}:{val}
          </Badge>
        );
      })}
    </div>
  );
}

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
      accessorKey: "kesim_sureleri",
      header: "Kesim Süreleri",
      cell: ({ row }) => (
        <KesimSureleriCell kesimSureleri={row.getValue("kesim_sureleri")} />
      ),
      size: 180,
      enableSorting: false,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const sku = row.getValue("sku") as string | null;
        if (!sku) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const style = getSkuBadgeStyle(sku);
        return (
          <Badge
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
