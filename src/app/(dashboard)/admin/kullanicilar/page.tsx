import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { UsersDataTable } from "./components/users-data-table";
import type { Database, UserRole, Station } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    role?: string;
    station?: string;
    active?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Kullanıcı Yönetimi" };

export default async function KullanicilarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const role = params.role || "";
  const station = params.station || "";
  const active = params.active || "";
  const sortBy = params.sortBy || "user_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select("*", { count: "exact" });

  // Search filter
  if (search) {
    query = query.or(
      `user_id.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  // Role filter
  if (role) {
    query = query.eq("role", role as UserRole);
  }

  // Station filter
  if (station) {
    query = query.eq("station", station as Station);
  }

  // Active filter
  if (active === "true") {
    query = query.eq("is_active", true);
  } else if (active === "false") {
    query = query.eq("is_active", false);
  }

  // Sorting
  const validSortColumns: (keyof User)[] = [
    "user_id",
    "full_name",
    "email",
    "role",
    "station",
    "is_active",
    "created_at",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof User)
    ? sortBy
    : "user_id";
  query = query.order(sortColumn, { ascending: sortOrder });

  // Pagination
  query = query.range(from, to);

  const { data: users, count, error } = await query;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Kullanıcı Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Kullanıcı listesi, rol ve istasyon filtresi, düzenleme ve yeni kullanıcı ekleme
        </p>
      </div>
      <UsersDataTable
        data={(users as User[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        role={role}
        station={station}
        active={active}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
