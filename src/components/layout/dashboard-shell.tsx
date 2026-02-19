"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import type { UserRole } from "@/lib/constants";

type DashboardShellProps = {
  children: React.ReactNode;
  userRole: UserRole;
  displayName: string;
  displayRole: string;
};

export function DashboardShell({
  children,
  userRole,
  displayName,
  displayRole,
}: DashboardShellProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.updateUser({
      data: { selected_operator_id: null, selected_operator_name: null },
    });
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          userRole={userRole}
          displayName={displayName}
          displayRole={displayRole}
          onLogout={handleLogout}
        />
        <SidebarInset>
          <TopNavbar displayName={displayName} displayRole={displayRole} />
          <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
            {children}
          </main>
        </SidebarInset>
        <MobileBottomNav userRole={userRole} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
