"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { UsersToolbar } from "./users-toolbar";
import { UserEditSheet } from "./user-edit-sheet";
import { getUserColumns } from "./user-columns";
import type { Database } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface UsersDataTableProps {
  data: User[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  role: string;
  station: string;
  active: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function UsersDataTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  search,
  role,
  station,
  active,
  sortBy,
  sortOrder,
}: UsersDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editUser, setEditUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/admin/kullanicilar?${params.toString()}`;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        router.push(buildUrl(updates));
      });
    },
    [buildUrl, router]
  );

  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      navigate({
        sortBy: columnId,
        sortOrder: desc ? "desc" : "asc",
        page: "0",
      });
    },
    [navigate]
  );

  const handleEdit = useCallback((user: User) => {
    setEditUser(user);
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditUser(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getUserColumns({
        onSort: handleSort,
        onEdit: handleEdit,
      }),
    [handleSort, handleEdit]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.user_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <UsersToolbar
            search={search}
            role={role}
            station={station}
            active={active}
            onSearchChange={(v) => navigate({ search: v || undefined, page: "0" })}
            onRoleChange={(v) => navigate({ role: v || undefined, page: "0" })}
            onStationChange={(v) => navigate({ station: v || undefined, page: "0" })}
            onActiveChange={(v) => navigate({ active: v || undefined, page: "0" })}
          />
        </div>
        <Button onClick={handleCreate} size="sm" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Kullanıcı
        </Button>
      </div>

      <DataTable
        table={table}
        onRowClick={handleEdit}
        emptyMessage="Kullanıcı bulunamadı."
      />

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={(page) => navigate({ page: String(page) })}
        onPageSizeChange={(size) =>
          navigate({ pageSize: String(size), page: "0" })
        }
      />

      <UserEditSheet
        user={editUser}
        mode={sheetMode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
