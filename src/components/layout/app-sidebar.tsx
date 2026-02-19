"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LogOut, ChevronUp } from "lucide-react";
import { getFilteredNavGroups, type NavGroup } from "@/lib/navigation";
import type { UserRole } from "@/lib/constants";

type AppSidebarProps = {
  userRole: UserRole;
  displayName: string;
  displayRole: string;
  onLogout: () => void;
};

export function AppSidebar({
  userRole,
  displayName,
  displayRole,
  onLogout,
}: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = getFilteredNavGroups(userRole);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary">
                  <span className="text-sm font-bold text-sidebar-primary-foreground">
                    VW
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">VigoWood</span>
                  <span className="text-xs text-sidebar-foreground/60">
                    Platform
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                <span className="text-xs font-semibold">
                  {displayName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {displayRole}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              tooltip="Çıkış Yap"
            >
              <LogOut />
              <span>Çıkış Yap</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
