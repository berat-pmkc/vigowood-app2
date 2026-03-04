"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Target, Box, Truck, LayoutDashboard, Calculator } from "lucide-react";

const tabs = [
  { title: "Genel Bakış", href: "/pazaryeri/fiyatlama", icon: LayoutDashboard, exact: true },
  { title: "Fiyatlama Paneli", href: "/pazaryeri/fiyatlama/panel", icon: Calculator },
  { title: "Hedef Fiyatlar", href: "/pazaryeri/fiyatlama/hedef-fiyatlar", icon: Target },
  { title: "Kutu Boyutları", href: "/pazaryeri/fiyatlama/kutu-boyutlari", icon: Box },
  { title: "Kargo Yönetimi", href: "/pazaryeri/fiyatlama/kargo", icon: Truck },
];

export function FiyatlamaNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
      <div className="mr-2 flex items-center gap-2 px-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-xs font-bold text-emerald-700">
          ₺
        </span>
        <span className="hidden text-sm font-semibold text-vw-dark sm:inline">Fiyatlama</span>
      </div>
      {tabs.map((tab) => {
        const isActive = (tab as { exact?: boolean }).exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
