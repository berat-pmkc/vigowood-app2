import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";
import { PRODUCT_CATEGORIES, PART_TYPE_LABELS } from "@/lib/constants";
import type { PartType } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Package,
  Puzzle,
  Layers,
  GitBranch,
  FileText,
  AlertTriangle,
  ArrowRight,
  Truck,
  Settings,
} from "lucide-react";
import { AdminBarChart } from "./components/admin-bar-chart";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    activeProductsRes,
    inactiveProductsRes,
    categoriesRes,
    totalPartsRes,
    partTypesRes,
    criticalPartsRes,
    plakalarRes,
    assemblyStepsRes,
    stepBomRes,
    sevkBekliyorRes,
    sevkHazirlaniyorRes,
    sevkYoldaRes,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("aktif_mi", true),
    supabase
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("aktif_mi", false),
    supabase.from("products").select("kategori"),
    supabase
      .from("all_parts")
      .select("part_id", { count: "exact", head: true }),
    supabase.from("all_parts").select("part_type"),
    supabase
      .from("all_parts")
      .select(
        "part_id, part_adi, part_type, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok"
      )
      .gt("hazir_eleman_kritik_stok", 0)
      .order("hazir_eleman_aktif_stok", { ascending: true })
      .limit(20),
    supabase
      .from("plakalar")
      .select("plakalar_id", { count: "exact", head: true }),
    supabase
      .from("assembly_steps")
      .select("step_id", { count: "exact", head: true }),
    supabase
      .from("step_bom")
      .select("sbom_id", { count: "exact", head: true }),
    supabase
      .from("sevkiyat")
      .select("id", { count: "exact", head: true })
      .eq("durum", "bekliyor"),
    supabase
      .from("sevkiyat")
      .select("id", { count: "exact", head: true })
      .eq("durum", "hazirlaniyor"),
    supabase
      .from("sevkiyat")
      .select("id", { count: "exact", head: true })
      .eq("durum", "yolda"),
  ]);

  const activeProducts = activeProductsRes.count ?? 0;
  const inactiveProducts = inactiveProductsRes.count ?? 0;
  const totalParts = totalPartsRes.count ?? 0;
  const plakalar = plakalarRes.count ?? 0;
  const assemblySteps = assemblyStepsRes.count ?? 0;
  const stepBom = stepBomRes.count ?? 0;
  const sevkBekliyor = sevkBekliyorRes.count ?? 0;
  const sevkHazirlaniyor = sevkHazirlaniyorRes.count ?? 0;
  const sevkYolda = sevkYoldaRes.count ?? 0;

  // Category distribution
  const categoryMap = new Map<string, number>();
  for (const row of categoriesRes.data ?? []) {
    const cat = (row as { kategori: string | null }).kategori ?? "Belirtilmemiş";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }
  const categoryData = PRODUCT_CATEGORIES.map((cat) => ({
    name: cat,
    value: categoryMap.get(cat) ?? 0,
  })).filter((d) => d.value > 0);

  // Part type distribution
  const partTypeMap = new Map<string, number>();
  for (const row of partTypesRes.data ?? []) {
    const pt = (row as { part_type: string | null }).part_type ?? "Bilinmiyor";
    partTypeMap.set(pt, (partTypeMap.get(pt) ?? 0) + 1);
  }
  const partTypeColors = ["#cdbd9d", "#3368b1", "#70c1aa", "#f28a19"];
  const partTypeData = (
    Object.keys(PART_TYPE_LABELS) as PartType[]
  ).map((key) => ({
    name: PART_TYPE_LABELS[key],
    value: partTypeMap.get(key) ?? 0,
  }));

  // Critical stock parts
  const criticalParts = (criticalPartsRes.data ?? []).filter(
    (p) =>
      (p as { hazir_eleman_aktif_stok: number }).hazir_eleman_aktif_stok <
      (p as { hazir_eleman_kritik_stok: number }).hazir_eleman_kritik_stok
  ) as Array<{
    part_id: string;
    part_adi: string;
    part_type: string;
    hazir_eleman_aktif_stok: number;
    hazir_eleman_kritik_stok: number;
  }>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Admin Yonetim Paneli
        </h1>
        <p className="text-muted-foreground">
          Urun, parca, plaka ve BOM verilerine genel bakis
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          title="Aktif Urunler"
          value={activeProducts}
          subtitle={`${formatNumber(inactiveProducts)} pasif`}
          icon={<Package className="size-5 text-blue-600" />}
          href="/admin/urunler"
          bgColor="bg-blue-50"
        />
        <KpiCard
          title="Toplam Parca"
          value={totalParts}
          icon={<Puzzle className="size-5 text-amber-600" />}
          href="/admin/parcalar"
          bgColor="bg-amber-50"
        />
        <KpiCard
          title="Plakalar"
          value={plakalar}
          icon={<Layers className="size-5 text-emerald-600" />}
          href="/admin/plakalar"
          bgColor="bg-emerald-50"
        />
        <KpiCard
          title="Montaj Adimlari"
          value={assemblySteps}
          icon={<GitBranch className="size-5 text-indigo-600" />}
          href="/admin/bom"
          bgColor="bg-indigo-50"
        />
        <KpiCard
          title="BOM Kayitlari"
          value={stepBom}
          icon={<FileText className="size-5 text-purple-600" />}
          href="/admin/bom"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Urun Kategori Dagilimi
            </CardTitle>
            <CardDescription>
              Toplam {formatNumber(activeProducts + inactiveProducts)} urun
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <AdminBarChart
                data={categoryData}
                color="#cdbd9d"
                height={Math.max(200, categoryData.length * 35)}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Veri bulunamadi
              </p>
            )}
          </CardContent>
        </Card>

        {/* Part Type Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Parca Tipi Dagilimi
            </CardTitle>
            <CardDescription>
              Toplam {formatNumber(totalParts)} parca
            </CardDescription>
          </CardHeader>
          <CardContent>
            {partTypeData.some((d) => d.value > 0) ? (
              <AdminBarChart
                data={partTypeData}
                colors={partTypeColors}
                height={180}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Veri bulunamadi
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Critical Stock Alerts */}
        <Card className={criticalParts.length > 0 ? "border-vw-error/30" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-vw-error">
              <AlertTriangle className="size-4" />
              Kritik Stok Uyarilari
            </CardTitle>
            <CardDescription>
              Stok seviyesi kritik olan parcalar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {criticalParts.length > 0 ? (
              <div className="space-y-2">
                {criticalParts.slice(0, 8).map((part) => (
                  <div
                    key={part.part_id}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {part.part_adi}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {part.part_id}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-sm font-bold text-vw-error">
                        {formatNumber(part.hazir_eleman_aktif_stok)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        / {formatNumber(part.hazir_eleman_kritik_stok)}
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  href="/admin/parcalar"
                  className="mt-2 flex items-center justify-center gap-1 text-xs text-vw-info hover:underline"
                >
                  Tumunu Gor
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Kritik stok uyarisi bulunmuyor
              </p>
            )}
          </CardContent>
        </Card>

        {/* Shipment Status + Quick Access */}
        <div className="space-y-4">
          {/* Shipment Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="size-4 text-vw-info" />
                Sevkiyat Durumu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <StatusCard
                  label="Bekliyor"
                  count={sevkBekliyor}
                  color="amber"
                />
                <StatusCard
                  label="Hazirlaniyor"
                  count={sevkHazirlaniyor}
                  color="blue"
                />
                <StatusCard
                  label="Yolda"
                  count={sevkYolda}
                  color="purple"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Access */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="size-4 text-muted-foreground" />
                Hizli Erisim
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <QuickLink
                  href="/admin/urunler"
                  icon={<Package className="size-4" />}
                  label="Urunler"
                  color="bg-blue-50 text-blue-700 hover:bg-blue-100"
                />
                <QuickLink
                  href="/admin/parcalar"
                  icon={<Puzzle className="size-4" />}
                  label="Parcalar"
                  color="bg-amber-50 text-amber-700 hover:bg-amber-100"
                />
                <QuickLink
                  href="/admin/plakalar"
                  icon={<Layers className="size-4" />}
                  label="Plakalar"
                  color="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                />
                <QuickLink
                  href="/admin/bom"
                  icon={<GitBranch className="size-4" />}
                  label="BOM"
                  color="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  href,
  bgColor,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  href: string;
  bgColor: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 pt-0">
          <div className={`rounded-lg p-2.5 ${bgColor}`}>{icon}</div>
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
}: {
  label: string;
  count: number;
  color: "amber" | "blue" | "purple";
}) {
  const colors = {
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
  };
  const textColors = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    purple: "text-purple-700",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className={`text-2xl font-bold ${textColors[color]}`}>
        {formatNumber(count)}
      </p>
      <p className={`text-xs font-medium ${textColors[color]}`}>{label}</p>
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
