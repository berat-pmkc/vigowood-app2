import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Scissors,
  Package,
  Layers,
  Box,
  Settings,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Activity,
  SprayCan,
  Wrench,
} from "lucide-react";
import type { UserRole } from "@/lib/constants";
import { DashboardRealtimeWrapper } from "./components/dashboard-realtime-wrapper";
import { PeriodFilter } from "./components/period-filter";

export const metadata: Metadata = { title: "Ana Sayfa" };

type PeriodType = "today" | "week" | "month" | "last_month";

function getPeriodDates(period: PeriodType): { start: string; end: string } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  switch (period) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "week": {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      startOfWeek.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { start: startOfWeek.toISOString().split("T")[0], end: todayStr };
    }
    case "month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth.toISOString().split("T")[0], end: todayStr };
    }
    case "last_month": {
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: firstLastMonth.toISOString().split("T")[0],
        end: lastLastMonth.toISOString().split("T")[0],
      };
    }
  }
}

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // getCurrentUserWithAuth() is React cache()'d — deduped with layout call
  const result = await getCurrentUserWithAuth();
  if (!result) redirect("/login");

  const { profile, auth } = result;
  const displayName = auth.operatorName || profile.full_name || "";
  const userRole = profile.role as UserRole;

  const supabase = await createClient();
  const params = await searchParams;
  const period = (["today", "week", "month", "last_month"].includes(params.period ?? "")
    ? params.period
    : "today") as PeriodType;
  const { start, end } = getPeriodDates(period);

  const today = new Date().toISOString().split("T")[0];

  // Build period-filtered queries for production KPIs
  function cutBatchPeriodQuery() {
    let q = supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true });
    q = q.gte("tarih", start).lte("tarih", end);
    return q;
  }

  function montajPeriodQuery() {
    let q = supabase
      .from("montaj_sessions")
      .select("session_id", { count: "exact", head: true })
      .eq("durum", "tamamlandi");
    q = q.gte("created_at", start + "T00:00:00").lte("created_at", end + "T23:59:59");
    return q;
  }

  function packPeriodQuery() {
    let q = supabase
      .from("pack_events")
      .select("session_id", { count: "exact", head: true });
    q = q.gte("created_at", start + "T00:00:00").lte("created_at", end + "T23:59:59");
    return q;
  }

  function kutuPeriodQuery() {
    let q = supabase
      .from("kutu_uretim")
      .select("session_id", { count: "exact", head: true });
    q = q.gte("created_at", start + "T00:00:00").lte("created_at", end + "T23:59:59");
    return q;
  }

  // Fetch dashboard data in parallel
  const [
    kesimRes,
    montajRes,
    paketlemeRes,
    kutuRes,
    completedTodayRes,
    recentCutsRes,
    criticalPartsRes,
  ] = await Promise.all([
    cutBatchPeriodQuery(),
    montajPeriodQuery(),
    packPeriodQuery(),
    kutuPeriodQuery(),
    supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true })
      .eq("durum", "tamamlandi")
      .gte("tarih", today)
      .lte("tarih", today),
    supabase
      .from("cut_batches")
      .select(
        "cut_id, tarih, sku, plaka_id, makine_id, adet, durum, operator_id"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .gt("hazir_eleman_kritik_stok", 0)
      .order("hazir_eleman_aktif_stok", { ascending: true })
      .limit(5),
  ]);

  const kesimCount = kesimRes.count ?? 0;
  const montajCount = montajRes.count ?? 0;
  const paketlemeCount = paketlemeRes.count ?? 0;
  const kutuCount = kutuRes.count ?? 0;
  const completedToday = completedTodayRes.count ?? 0;
  const recentCuts = (recentCutsRes.data ?? []) as Array<{
    cut_id: string;
    tarih: string;
    sku: string | null;
    plaka_id: string | null;
    makine_id: string | null;
    adet: number;
    durum: string;
    operator_id: string | null;
  }>;

  // Filter critical stock parts (actual stock < critical level)
  const criticalParts = (criticalPartsRes.data ?? []).filter(
    (p) => p.hazir_eleman_aktif_stok < p.hazir_eleman_kritik_stok
  ) as Array<{
    part_id: string;
    part_adi: string;
    part_type: string;
    hazir_eleman_aktif_stok: number;
    hazir_eleman_kritik_stok: number;
  }>;

  const isAdmin = ["Yönetici", "Endüstri Mühendisi"].includes(userRole);

  return (
    <DashboardRealtimeWrapper>
    <div className="animate-fade-in space-y-6">
      {/* Period Filter */}
      <PeriodFilter activePeriod={period} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Kesim"
          value={kesimCount}
          icon={<Scissors className="size-5 text-amber-600" />}
          href="/uretim/kesim"
          color="warning"
        />
        <KpiCard
          title="Montaj"
          value={montajCount}
          icon={<Wrench className="size-5 text-emerald-600" />}
          href="/uretim/montaj"
          color="success"
        />
        <KpiCard
          title="Paketleme"
          value={paketlemeCount}
          icon={<Package className="size-5 text-vw-info" />}
          href="/uretim/paketleme"
          color="blue"
        />
        <KpiCard
          title="Kutu-Koli"
          value={kutuCount}
          icon={<Box className="size-5 text-vw-primary" />}
          href="/uretim/kutu-koli"
          color="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Üretim Durumu */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-vw-info" />
              Üretim Durumu
            </CardTitle>
            <CardDescription>Kesim hattı güncel özet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <StatusCard
                label="Bugün Tamamlanan"
                count={completedToday}
                color="emerald"
              />
            </div>

            {/* Son Kesimler */}
            {recentCuts.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Son Kesimler
                  </h3>
                  <Link
                    href="/uretim/kesim"
                    className="flex items-center gap-1 text-xs text-vw-info hover:underline"
                  >
                    Tümünü Gör
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {recentCuts.map((cut) => (
                    <div
                      key={cut.cut_id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <CutStatusDot durum={cut.durum} />
                        <div>
                          <p className="text-sm font-medium">{cut.cut_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {cut.sku || "—"} · {cut.makine_id || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatNumber(cut.adet)} adet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(cut.tarih)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sağ Panel */}
        <div className="space-y-4">
          {/* Hızlı Erişim */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hızlı Erişim</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <QuickLink
                  href="/uretim/kesim"
                  icon={<Scissors className="size-4" />}
                  label="Kesim"
                  color="bg-amber-50 text-amber-700 hover:bg-amber-100"
                />
                <QuickLink
                  href="/uretim/temizlik"
                  icon={<SprayCan className="size-4" />}
                  label="Temizlik"
                  color="bg-blue-50 text-blue-700 hover:bg-blue-100"
                />
                <QuickLink
                  href="/uretim/montaj"
                  icon={<Wrench className="size-4" />}
                  label="Montaj"
                  color="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                />
                <QuickLink
                  href="/uretim/paketleme"
                  icon={<Package className="size-4" />}
                  label="Paketleme"
                  color="bg-purple-50 text-purple-700 hover:bg-purple-100"
                />
                {isAdmin && (
                  <>
                    <QuickLink
                      href="/admin/urunler"
                      icon={<Settings className="size-4" />}
                      label="Admin"
                      color="bg-slate-50 text-slate-700 hover:bg-slate-100"
                    />
                    <QuickLink
                      href="/admin/bom"
                      icon={<Layers className="size-4" />}
                      label="BOM"
                      color="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Kritik Stok Uyarıları */}
          {criticalParts.length > 0 && (
            <Card className="border-vw-error/30 bg-gradient-to-b from-red-50/30 to-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-vw-error">
                  <AlertTriangle className="size-4" />
                  Kritik Stok
                </CardTitle>
                <CardDescription>
                  Stok seviyesi kritik parçalar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalParts.slice(0, 4).map((part) => (
                    <div
                      key={part.part_id}
                      className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{part.part_adi}</p>
                        <p className="text-xs text-muted-foreground">
                          {part.part_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-vw-error">
                          {formatNumber(part.hazir_eleman_aktif_stok)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          / {formatNumber(part.hazir_eleman_kritik_stok)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/admin/parcalar"
                  className="mt-3 flex items-center justify-center gap-1 text-xs text-vw-info hover:underline"
                >
                  Tüm Parçaları Gör
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Sistem Özeti */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-vw-success" />
                Sistem Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <SummaryRow
                  label="Bugün Tamamlanan Kesim"
                  value={completedToday}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DashboardRealtimeWrapper>
  );
}

/* ---------- Sub-components ---------- */

function KpiCard({
  title,
  value,
  icon,
  href,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  color: "blue" | "primary" | "warning" | "success";
}) {
  return (
    <Link href={href} className="group">
      <Card className="card-hover">
        <CardContent className="flex items-center gap-4 pt-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">
              {formatNumber(value)}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusCard({
  label,
  count,
  color,
  subtitle,
}: {
  label: string;
  count: number;
  color: "amber" | "blue" | "emerald";
  subtitle?: string;
}) {
  const colors = {
    amber: "border-amber-200/50 bg-amber-50/50",
    blue: "border-blue-200/50 bg-blue-50/50",
    emerald: "border-emerald-200/50 bg-emerald-50/50",
  };
  const textColors = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
  };
  const dotColors = {
    amber: "bg-amber-400",
    blue: "bg-blue-500 animate-pulse-subtle",
    emerald: "bg-emerald-500",
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <p className={`text-3xl font-bold ${textColors[color]}`}>
        {formatNumber(count)}
      </p>
      <p className={`flex items-center justify-center gap-1.5 text-xs font-medium ${textColors[color]}`}>
        <span className={`status-dot ${dotColors[color]}`} />
        {label}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${color}`}
    >
      {icon}
      {label}
    </Link>
  );
}

function CutStatusDot({ durum }: { durum: string }) {
  const colors: Record<string, string> = {
    bekliyor: "bg-amber-400",
    kesiliyor: "bg-blue-500 animate-pulse",
    tamamlandi: "bg-emerald-500",
  };
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${
        colors[durum] ?? "bg-gray-400"
      }`}
    />
  );
}

function SummaryRow({
  label,
  value,
  warning,
  active,
}: {
  label: string;
  value: number;
  warning?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold ${
          warning
            ? "rounded-md bg-amber-50 px-2 py-0.5 text-vw-warning"
            : active
              ? "rounded-md bg-blue-50 px-2 py-0.5 text-vw-info"
              : "text-foreground"
        }`}
      >
        {formatNumber(value)}
      </span>
    </div>
  );
}
