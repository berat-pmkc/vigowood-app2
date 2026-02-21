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
import { formatDate } from "@/lib/utils";
import { deleteUser } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Database, UserRole } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (user: User) => void;
}

const roleBadgeColors: Record<UserRole, string> = {
  "Yönetici": "bg-red-100 text-red-800 border-red-200",
  "Endüstri Mühendisi": "bg-purple-100 text-purple-800 border-purple-200",
  "E-Ticaret Müdürü": "bg-blue-100 text-blue-800 border-blue-200",
  "Dış Ticaret Müdürü": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Üretim": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Hat": "bg-teal-100 text-teal-800 border-teal-200",
  "Muhasebe": "bg-amber-100 text-amber-800 border-amber-200",
  "Sevkiyat Sorumlusu": "bg-orange-100 text-orange-800 border-orange-200",
  "Pazaryeri Sorumlusu": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Mimar": "bg-pink-100 text-pink-800 border-pink-200",
};

function UserActionsCell({
  user,
  onEdit,
}: {
  user: User;
  onEdit: (user: User) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteUser(user.user_id);
      if (result.success) {
        toast.success("Kullanıcı silindi");
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
          <DropdownMenuItem onClick={() => onEdit(user)}>
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
            <AlertDialogTitle>Kullanıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{user.user_id}</strong> — {user.full_name}{" "}
              kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri
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

export function getUserColumns({
  onSort,
  onEdit,
}: ColumnOptions): ColumnDef<User>[] {
  return [
    {
      accessorKey: "user_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kullanıcı ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("user_id")}</span>
      ),
      size: 120,
    },
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ad Soyad" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.getValue("full_name") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="E-posta" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.getValue("email") || "—"}
        </span>
      ),
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rol" onSort={onSort} />
      ),
      cell: ({ row }) => {
        const role = row.getValue("role") as UserRole;
        return (
          <Badge
            variant="outline"
            className={`text-xs whitespace-nowrap ${roleBadgeColors[role] || ""}`}
          >
            {role}
          </Badge>
        );
      },
      size: 160,
    },
    {
      accessorKey: "station",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="İstasyon" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("station") || "—"}</span>
      ),
      meta: { className: "hidden md:table-cell" },
      size: 140,
    },
    {
      accessorKey: "is_active",
      header: "Durum",
      cell: ({ row }) => {
        const active = row.getValue("is_active") as boolean;
        return active ? (
          <Badge className="bg-vw-success/20 text-vw-success hover:bg-vw-success/30 border-vw-success/30 text-xs">
            Aktif
          </Badge>
        ) : (
          <Badge className="bg-vw-error/20 text-vw-error hover:bg-vw-error/30 border-vw-error/30 text-xs">
            Pasif
          </Badge>
        );
      },
      size: 80,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kayıt Tarihi" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.getValue("created_at"))}
        </span>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 120,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;
        return <UserActionsCell user={user} onEdit={onEdit} />;
      },
      size: 50,
    },
  ];
}
