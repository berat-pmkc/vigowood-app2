"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getFilteredNavGroups } from "@/lib/navigation";
import type { UserRole } from "@/lib/constants";
import { LayoutDashboard, type LucideIcon } from "lucide-react";

type MobileBottomNavProps = {
  userRole: UserRole;
};

/**
 * Bottom navigation for mobile/tablet (< md breakpoint).
 * Shows max 5 most relevant items based on user role.
 */
export function MobileBottomNav({ userRole }: MobileBottomNavProps) {
  const pathname = usePathname();
  const navGroups = getFilteredNavGroups(userRole);

  // Flatten and pick top 5 items for bottom nav
  const allItems = navGroups.flatMap((g) => g.items);
  const bottomItems = allItems.slice(0, 5);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors",
                active
                  ? "text-vw-dark font-medium"
                  : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-5",
                  active && "text-vw-primary"
                )}
              />
              <span className="truncate max-w-[4.5rem]">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
