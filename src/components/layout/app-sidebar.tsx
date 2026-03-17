"use client";

import { useMemo } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LogOut, ChevronRight } from "lucide-react";
import { getFilteredNavGroups, type NavGroup } from "@/lib/navigation";
import type { UserRole } from "@/lib/constants";
import { UserAvatar } from "@/components/shared/user-avatar";

type AppSidebarProps = {
  userRole: UserRole;
  displayName: string;
  displayRole: string;
  avatarUrl?: string | null;
  allowedModules?: string[] | null;
  onLogout: () => void;
};

export function AppSidebar({
  userRole,
  displayName,
  displayRole,
  avatarUrl,
  allowedModules,
  onLogout,
}: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = getFilteredNavGroups(userRole, allowedModules);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  /** Aktif sayfayı içeren grubun label'ını bul */
  const activeGroupLabel = useMemo(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => isActive(item.href))) {
        return group.label;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navGroups]);

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
        {navGroups.map((group) => {
          const isSingleItem = group.items.length === 1;
          const groupIsActive = group.label === activeGroupLabel;

          /* Tek item'lı gruplar (Ana Sayfa) collapsible olmaz */
          if (isSingleItem) {
            const item = group.items[0];
            return (
              <SidebarGroup key={group.label} className="py-0.5 px-2">
                <SidebarMenu className="gap-0.5">
                  <SidebarMenuItem>
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
                </SidebarMenu>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible
              key={group.label}
              defaultOpen={groupIsActive}
              className="group/collapsible"
            >
              <SidebarGroup className="py-0.5 px-2">
                <SidebarGroupLabel
                  asChild
                  className="h-7 text-[11px] font-semibold tracking-wide uppercase cursor-pointer hover:text-sidebar-foreground transition-colors"
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2">
                    <span className="w-[3px] h-3.5 rounded-full bg-vw-primary/70 shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default"
            >
              <UserAvatar
                avatarUrl={avatarUrl}
                fullName={displayName}
                size="default"
              />
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
