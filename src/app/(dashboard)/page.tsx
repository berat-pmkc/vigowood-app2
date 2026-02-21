import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Scissors,
  Package,
  Layers,
  Component,
  Box,
  Settings,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Activity,
  SprayCan,
  Wrench,
} from "lucide-react";
import type { UserRole } from "@/lib/constants";
import { DashboardRealtimeWrapper } from "./components/dashboard-realtime-wrapper";

export const metadata: Metadata = { title: "Ana Sayfa" };

export default async function DashboardPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const operatorName = user?.user_metadata?.selected_operator_name;
  const displayName = operatorName || profile.full_name || "";
  const userRole = profile.role as UserRole;

  const today = new Date().toISOString().split("T")[0];

  // Fetch dashboard data in parallel
  const [
    activeProductsRes,
    totalPartsRes,
    todayCutsRes,
    pendingCutsRes,
    cuttingCutsRes,
    completedTodayRes,
    recentCutsRes,
    criticalPartsRes,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("aktif_mi", true),
    supabase
      .from("all_parts")
      .select("part_id", { count: "exact", head: true }),
    supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true })
      .eq("tarih", today),
    supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true })
      .eq("durum", "bekliyor"),
    supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true })
      .eq("durum", "kesiliyor"),
    supabase
      .from("cut_batches")
      .select("cut_id", { count: "exact", head: true })
      .eq("tarih", today)
      .eq("durum", "tamamlandi"),
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

  const activeProducts = activeProductsRes.count ?? 0;
  const totalParts = totalPartsRes.count ?? 0;
  const todayCuts = todayCutsRes.count ?? 0;
  const pendingCuts = pendingCutsRes.count ?? 0;
  const cuttingCuts = cuttingCutsRes.count ?? 0;
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

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Gunaydin" : now.getHours() < 18 ? "Iyi gunler" : "Iyi aksamlar";
  const todayStr = now.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isProduction = ["Üretim", "Hat"].includes(userRole);
  const isAdmin = ["Yönetici", "Endüstri Mühendisi"].includes(userRole);

  return (
    <DashboardRealtimeWrapper>
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl bg-gradient-to-r from-vw-deep to-vw-dark p-6 text-white">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Hos geldiniz, {displayName}
            </h1>
            <p className="mt-1 text-sm text-white/70">{todayStr}</p>
          </div>
          <Badge
            variant="secondary"
            className="mt-2 w-fit bg-white/15 text-white hover:bg-white/20 sm:mt-0"
          >
            {userRole}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Aktif Urunler"
          value={activeProducts}
          icon={<Package className="size-5 text-vw-info" />}
          href="/admin/urunler"
          color="blue"
        />
        <KpiCard
          title="Toplam Parca"
          value={totalParts}
          icon={<Component className="size-5 text-vw-primary" />}
          href="/admin/parcalar"
          color="primary"
        />
        <KpiCard
          title="Bekleyen Kesim"
          value={pendingCuts}
          icon={<Clock className="size-5 text-vw-warning" />}
          href="/uretim/kesim"
          color="warning"
          highlight={pendingCuts > 0}
        />
        <KpiCard
          title="Bugunku Kesim"
          value={todayCuts}
          subtitle={`${completedToday} tamamlandi`}
          icon={<Scissors className="size-5 text-vw-success" />}
          href="/uretim/kesim"
          color="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Üretim Durumu */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-vw-info" />
              Uretim Durumu
            </CardTitle>
            <CardDescription>Kesim hatti guncel ozet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <StatusCard
                label="Bekliyor"
                count={pendingCuts}
                color="amber"
              />
              <StatusCard
                label="Kesiliyor"
                count={cuttingCuts}
                color="blue"
              />
              <StatusCard
                label="Tamamlandi"
                count={completedToday}
                color="emerald"
                subtitle="bugun"
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
                    Tumunu Gor
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
              <CardTitle className="text-base">Hizli Erisim</CardTitle>
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
            <Card className="border-vw-error/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-vw-error">
                  <AlertTriangle className="size-4" />
                  Kritik Stok
                </CardTitle>
                <CardDescription>
                  Stok seviyesi kritik parcalar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalParts.slice(0, 4).map((part) => (
                    <div
                      key={part.part_id}
                      className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"
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
                  Tum Parcalari Gor
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
                Sistem Ozeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <SummaryRow label="Aktif Urunler" value={activeProducts} />
                <SummaryRow label="Toplam Parca" value={totalParts} />
                <SummaryRow
                  label="Bekleyen Kesim"
                  value={pendingCuts}
                  warning={pendingCuts > 5}
                />
                <SummaryRow
                  label="Devam Eden"
                  value={cuttingCuts}
                  active={cuttingCuts > 0}
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
  subtitle,
  icon,
  href,
  color,
  highlight,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  href: string;
  color: "blue" | "primary" | "warning" | "success";
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={`transition-shadow hover:shadow-md ${
          highlight ? "border-vw-warning/50 bg-amber-50/30" : ""
        }`}
      >
        <CardContent className="flex items-center gap-3 pt-0">
          <div className="rounded-lg bg-muted p-2.5">{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold tracking-tight">
              {formatNumber(value)}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
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
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  const textColors = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className={`text-2xl font-bold ${textColors[color]}`}>
        {formatNumber(count)}
      </p>
      <p className={`text-xs font-medium ${textColors[color]}`}>{label}</p>
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
      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${color}`}
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
            ? "text-vw-warning"
            : active
              ? "text-vw-info"
              : "text-foreground"
        }`}
      >
        {formatNumber(value)}
      </span>
    </div>
  );
}
