"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatNumber } from "@/lib/utils";
import { deleteProduct, duplicateProduct } from "../actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}

function ProductActionsCell({
  product,
  onEdit,
  onToggleActive,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newUrunAdi, setNewUrunAdi] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProduct(product.sku);
      if (result.success) {
        toast.success("Ürün silindi");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const openDuplicate = () => {
    setNewSku("");
    setNewUrunAdi("");
    setDuplicateOpen(true);
  };

  const handleDuplicate = () => {
    const trimmed = newSku.trim();
    if (!trimmed) {
      toast.error("Yeni SKU gereklidir");
      return;
    }
    if (trimmed === product.sku) {
      toast.error("Yeni SKU, kaynak SKU ile aynı olamaz");
      return;
    }
    startTransition(async () => {
      const result = await duplicateProduct(
        product.sku,
        trimmed,
        newUrunAdi.trim() || undefined
      );
      if (result.success) {
        toast.success(`${result.sku} olarak kopyalandı`);
        setDuplicateOpen(false);
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
          <DropdownMenuItem onClick={() => onEdit(product)}>
            Düzenle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleActive(product)}>
            {product.aktif_mi ? "Pasif Yap" : "Aktif Yap"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              openDuplicate();
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Kopyala
          </DropdownMenuItem>
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
            <AlertDialogTitle>Ürünü Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{product.sku}</strong> — {product.urun_adi || "İsimsiz"}{" "}
              ürününü silmek istediğinize emin misiniz? Bu ürünün montaj
              adımları ve reçetesi de silinecektir. Bu işlem geri alınamaz.
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

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Ürünü Kopyala</DialogTitle>
            <DialogDescription>
              <strong>{product.sku}</strong> ürününün reçetesi ve tanımlayıcı
              alanları yeni bir SKU altında kopyalanır. Stok ve satış geçmişi
              kopyalanmaz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-sku">Yeni SKU</Label>
              <Input
                id="new-sku"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="ör. AE-2"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-urun-adi">Yeni Ürün Adı (opsiyonel)</Label>
              <Input
                id="new-urun-adi"
                value={newUrunAdi}
                onChange={(e) => setNewUrunAdi(e.target.value)}
                placeholder={product.urun_adi || ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicateOpen(false)}
              disabled={isPending}
            >
              İptal
            </Button>
            <Button onClick={handleDuplicate} disabled={isPending}>
              {isPending ? "Kopyalanıyor..." : "Kopyala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function getProductColumns({
  onSort,
  onEdit,
  onToggleActive,
}: ColumnOptions): ColumnDef<Product>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tümünü seç"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Satır seç"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      size: 40,
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
      accessorKey: "urun_adi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ürün Adı" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block sm:max-w-none">
          {row.getValue("urun_adi") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "kategori",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kategori" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const kategori = row.getValue("kategori") as string | null;
        if (!kategori) return "—";
        return (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {kategori}
          </Badge>
        );
      },
      meta: { className: "hidden md:table-cell" },
      size: 160,
    },
    {
      accessorKey: "aktif_mi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Durum" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const aktif = row.getValue("aktif_mi") as boolean;
        return (
          <Badge
            variant={aktif ? "default" : "secondary"}
            className={
              aktif
                ? "bg-vw-success/20 text-vw-success hover:bg-vw-success/30 border-vw-success/30"
                : "bg-vw-error/20 text-vw-error hover:bg-vw-error/30 border-vw-error/30"
            }
          >
            {aktif ? "Aktif" : "Pasif"}
          </Badge>
        );
      },
      size: 90,
    },
    {
      accessorKey: "stok_aktif",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Stok"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const stok = row.getValue("stok_aktif") as number;
        return (
          <div className={`text-right font-mono text-sm ${stok < 0 ? "text-vw-error font-semibold" : ""}`}>
            {formatNumber(stok)}
          </div>
        );
      },
      size: 90,
    },
    {
      accessorKey: "gunluk_satis",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Günlük Satış"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("gunluk_satis") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? val.toFixed(2).replace(".", ",") : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 110,
    },
    {
      accessorKey: "aylik_uretim",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Aylık Üretim"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {formatNumber(row.getValue("aylik_uretim"))}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 110,
    },
    {
      accessorKey: "kutu_boy_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Boy (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_boy_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      accessorKey: "kutu_en_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="En (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_en_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      accessorKey: "kutu_yukseklik_cm",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Yükseklik (cm)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("kutu_yukseklik_cm") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? formatNumber(val) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 100,
    },
    {
      accessorKey: "urun_agirlik_kg",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Ağırlık (kg)"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue("urun_agirlik_kg") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {val != null ? val.toFixed(2) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 90,
    },
    {
      accessorKey: "desi",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Desi"
          onSort={onSort}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const desi = row.getValue("desi") as number | null;
        return (
          <div className="text-right font-mono text-sm">
            {desi != null ? desi.toFixed(2) : "—"}
          </div>
        );
      },
      meta: { className: "hidden lg:table-cell" },
      size: 80,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <ProductActionsCell
            product={product}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
          />
        );
      },
      size: 50,
    },
  ];
}
