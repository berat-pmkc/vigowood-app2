"use client";

import { useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, UserMinus, UserCheck, Eye, EyeOff } from "lucide-react";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate } from "@/lib/utils";
import { setUserActive } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
type UserRole = "Yönetici" | "Endüstri Mühendisi" | "E-Ticaret Müdürü" | "Dış Ticaret Müdürü" | "Üretim" | "Hat" | "Muhasebe" | "Sevkiyat Sorumlusu" | "Pazaryeri Sorumlusu" | "Mimar";
import type { UserWithLastSignIn } from "../page";

interface ColumnOptions {
  onSort: (columnId: string, desc: boolean) => void;
  onEdit: (user: UserWithLastSignIn) => void;
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

function PasswordCell({ password }: { password: string | null }) {
  const [visible, setVisible] = useState(false);
  if (!password) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs">
        {visible ? password : "••••••••"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation();
          setVisible(!visible);
        }}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

function UserActionsCell({
  user,
  onEdit,
}: {
  user: UserWithLastSignIn;
  onEdit: (user: UserWithLastSignIn) => void;
}) {
  const router = useRouter();
  const [onayOpen, setOnayOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pasifeAlinacak = user.is_active;

  const handleDurumDegistir = () => {
    startTransition(async () => {
      const result = await setUserActive(user.user_id, !user.is_active);
      if (result.success) {
        toast.success(pasifeAlinacak ? "Kullanıcı pasife alındı" : "Kullanıcı aktif edildi");
        setOnayOpen(false);
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
              setOnayOpen(true);
            }}
            className={
              pasifeAlinacak ? "text-destructive focus:text-destructive" : ""
            }
          >
            {pasifeAlinacak ? (
              <UserMinus className="mr-2 h-4 w-4" />
            ) : (
              <UserCheck className="mr-2 h-4 w-4" />
            )}
            {pasifeAlinacak ? "Pasife Al" : "Aktif Et"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={onayOpen} onOpenChange={setOnayOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pasifeAlinacak ? "Kullanıcıyı Pasife Al" : "Kullanıcıyı Aktif Et"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{user.user_id}</strong> — {user.full_name}
              {pasifeAlinacak
                ? " artık giriş yapamayacak ve personel seçim listelerinde görünmeyecek. Yoklama, üretim ve görev geçmişi olduğu gibi korunur; istediğiniz zaman yeniden aktif edebilirsiniz."
                : " yeniden giriş yapabilecek ve personel listelerinde görünecek."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDurumDegistir}
              disabled={isPending}
              className={
                pasifeAlinacak
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : ""
              }
            >
              {isPending
                ? "İşleniyor..."
                : pasifeAlinacak
                  ? "Pasife Al"
                  : "Aktif Et"}
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
}: ColumnOptions): ColumnDef<UserWithLastSignIn>[] {
  return [
    {
      accessorKey: "user_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("user_id")}</span>
      ),
      size: 90,
    },
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ad Soyad" onSort={onSort} />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <UserAvatar
            avatarUrl={row.original.avatar_url}
            fullName={row.getValue("full_name")}
            size="sm"
          />
          <span className="font-medium">
            {row.getValue("full_name") || "—"}
          </span>
        </div>
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
      accessorKey: "password_plain",
      header: "Şifre",
      cell: ({ row }) => (
        <PasswordCell password={row.getValue("password_plain")} />
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 140,
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
      accessorKey: "can_be_ops_assignee",
      header: "OPS Atama",
      cell: ({ row }) => {
        const val = row.getValue("can_be_ops_assignee") as boolean;
        return val ? (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs hover:bg-blue-100">
            Evet
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
      size: 90,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "last_sign_in_at",
      header: "Son Giriş",
      cell: ({ row }) => {
        const lastSignIn = row.getValue("last_sign_in_at") as string | null;
        if (!lastSignIn) return <span className="text-muted-foreground text-xs">—</span>;
        try {
          return (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {new Date(lastSignIn).toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
      },
      meta: { className: "hidden xl:table-cell" },
      size: 140,
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
