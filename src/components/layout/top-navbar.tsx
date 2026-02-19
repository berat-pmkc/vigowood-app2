"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type TopNavbarProps = {
  displayName: string;
  displayRole: string;
};

export function TopNavbar({ displayName, displayRole }: TopNavbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-between">
        {/* Breadcrumb area — can be extended later */}
        <div />

        {/* Right side — user info + notifications */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/bildirimler">
              <Bell className="size-4" />
            </Link>
          </Button>

          <Separator orientation="vertical" className="h-4" />

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground">{displayRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
