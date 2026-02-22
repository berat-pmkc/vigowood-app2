"use client";

import Link from "next/link";
import Image from "next/image";
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
import { LogOut } from "lucide-react";
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
                <Image
                  src="/logo-yuvarlak.svg"
                  alt="VigoWood"
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-full"
                />
                <div className="flex flex-col gap-0.5 leading-none">
                  <Image
                    src="/logo-yatay-white.png"
                    alt="VigoWood"
                    width={100}
                    height={23}
                    className="h-4 w-auto"
                  />
                  <span className="text-xs text-sidebar-foreground/60">
                    Platform
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1 px-2">
            <SidebarGroupLabel className="h-6 text-[11px]">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
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
