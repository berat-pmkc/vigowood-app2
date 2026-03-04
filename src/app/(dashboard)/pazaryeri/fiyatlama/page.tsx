import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Box, Truck, Package } from "lucide-react";
import Link from "next/link";

export default async function FiyatlamaPage() {
  // Cast to any — new tables not yet in generated Supabase types
  const supabase = (await createClient()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [
    { count: hedefCount },
    { count: kutuCount },
    { count: kargoCount },
    { count: listingCount },
  ] = await Promise.all([
    supabase.from("product_target_prices").select("*", { count: "exact", head: true }),
    supabase.from("product_box_dimensions").select("*", { count: "exact", head: true }),
    supabase.from("shipping_providers").select("*", { count: "exact", head: true }),
    supabase.from("marketplace_listings").select("*", { count: "exact", head: true }).eq("aktif", true),
  ]);

  const cards = [
    {
      title: "Hedef Fiyatlar",
      description: "SKU bazlı perakende ve toptan hedef fiyatları yönetin",
      href: "/pazaryeri/fiyatlama/hedef-fiyatlar",
      icon: Target,
      count: hedefCount ?? 0,
      label: "ürün",
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Kutu Boyutları",
      description: "Ürün kutu boyutları ve desi hesaplamaları",
      href: "/pazaryeri/fiyatlama/kutu-boyutlari",
      icon: Box,
      count: kutuCount ?? 0,
      label: "ürün",
      color: "text-amber-600 bg-amber-100",
    },
    {
      title: "Kargo Yönetimi",
      description: "Kargo firmaları, desi tabloları ve pazaryeri eşleştirmeleri",
      href: "/pazaryeri/fiyatlama/kargo",
      icon: Truck,
      count: kargoCount ?? 0,
      label: "kargo firması",
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      title: "Aktif Listingler",
      description: "Pazaryerlerindeki aktif ürün listingleri",
      href: "/pazaryeri/fiyatlama",
      icon: Package,
      count: listingCount ?? 0,
      label: "listing",
      color: "text-purple-600 bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Fiyatlama Paneli</h1>
        <p className="text-sm text-muted-foreground">Pazaryeri fiyatları, hedef fiyatlar, kutu boyutları ve kargo yönetimi</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={cn("rounded-lg p-2", card.color)}>
                  <card.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.count}</div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
