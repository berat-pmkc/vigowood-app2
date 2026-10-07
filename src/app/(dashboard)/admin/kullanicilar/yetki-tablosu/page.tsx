import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NAV_GROUPS } from "@/lib/navigation";
import { YetkiTablosuClient, type YetkiGroup, type YetkiUser } from "./yetki-tablosu-client";

export const metadata: Metadata = { title: "Yetki Tablosu" };
export const dynamic = "force-dynamic";

/** Üretim/Hat için sunucu tarafında da engellenen sayfalar (href önekleri) */
const STATION_BLOCKED_PREFIXES = ["/ops", "/talepler", "/stok/iade", "/stok/sayim", "/stok/kritik-stok", "/personel"];

export default async function YetkiTablosuPage() {
  const me = await getCurrentUser();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("user_id, full_name, email, role, station, allowed_modules")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    return <p className="p-6 text-destructive">Veri yüklenirken hata oluştu: {error.message}</p>;
  }

  const groups: YetkiGroup[] = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({
      href: i.href,
      title: i.title,
      stationBlocked: STATION_BLOCKED_PREFIXES.some((p) => i.href === p || i.href.startsWith(p + "/")),
    })),
  }));

  const users: YetkiUser[] = (data ?? []).map((u) => ({
    user_id: u.user_id as string,
    full_name: (u.full_name as string) ?? (u.user_id as string),
    email: (u.email as string | null) ?? null,
    role: u.role as string,
    station: (u.station as string | null) ?? null,
    allowed_modules: (u.allowed_modules as string[] | null) ?? null,
  }));

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yetki Tablosu</h1>
          <p className="text-sm text-muted-foreground">
            Kim hangi bölüm ve sayfayı görüyor — kenar çubuğuyla aynı kurallar (rol + modül izinleri)
          </p>
        </div>
        <Link href="/admin/kullanicilar" className="inline-flex items-center gap-1 text-sm text-vw-deep hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Kullanıcı Yönetimi
        </Link>
      </div>
      <YetkiTablosuClient groups={groups} users={users} />
    </div>
  );
}
