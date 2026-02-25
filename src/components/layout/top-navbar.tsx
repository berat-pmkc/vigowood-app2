"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { RealtimeIndicator } from "@/components/shared/realtime-indicator";
import { UserAvatar } from "@/components/shared/user-avatar";

type TopNavbarProps = {
  displayName: string;
  displayRole: string;
  userId?: string;
  avatarUrl?: string | null;
};

function getTodayString() {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TopNavbar({ displayName, displayRole, userId, avatarUrl }: TopNavbarProps) {
  const unreadCount = useUnreadCount(userId ?? null);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-between">
        {/* Breadcrumb area — can be extended later */}
        <div />

        {/* Right side — user info + notifications + date */}
        <div className="flex items-center gap-3">
          <RealtimeIndicator />

          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/bildirimler">
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <Separator orientation="vertical" className="h-4" />

          <UserAvatar avatarUrl={avatarUrl} fullName={displayName} size="default" />

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground">{displayRole}</p>
          </div>

          <Separator orientation="vertical" className="hidden h-4 sm:block" />

          <p className="hidden text-xs text-muted-foreground sm:block">
            {getTodayString()}
          </p>
        </div>
      </div>
    </header>
  );
}
