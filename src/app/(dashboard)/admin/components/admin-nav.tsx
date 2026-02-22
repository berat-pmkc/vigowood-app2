"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, Puzzle, Layers, GitBranch, DollarSign, LayoutTemplate, Building2, Users, Settings, Cog, Wrench } from "lucide-react";

const adminTabs: {
  label: string;
  href: string;
  icon: typeof Package;
  disabled?: boolean;
  exact?: boolean;
}[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Ürünler", href: "/admin/urunler", icon: Package },
  { label: "Parçalar", href: "/admin/parcalar", icon: Puzzle },
  { label: "Hazır Eleman", href: "/admin/hazir-eleman", icon: Wrench },
  { label: "Plakalar", href: "/admin/plakalar", icon: Layers },
  { label: "BOM", href: "/admin/bom", icon: GitBranch },
  { label: "Makineler", href: "/admin/makineler", icon: Cog },
  { label: "Fiyatlar", href: "/admin/fiyatlar", icon: DollarSign },
  { label: "Şablonlar", href: "/admin/palet-sablonlari", icon: LayoutTemplate },
  { label: "Firmalar", href: "/admin/firmalar", icon: Building2 },
  { label: "Kullanıcılar", href: "/admin/kullanicilar", icon: Users },
  { label: "Ayarlar", href: "/admin/ayarlar", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b px-4 sm:px-6">
      {adminTabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        if (tab.disabled) {
          return (
            <span
              key={tab.href}
              className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
