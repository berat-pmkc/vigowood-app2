"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SWRProvider } from "@/components/providers/swr-provider";
import type { UserRole } from "@/lib/constants";

type DashboardShellProps = {
  children: React.ReactNode;
  userRole: UserRole;
  displayName: string;
  displayRole: string;
  userId?: string;
  avatarUrl?: string | null;
  allowedModules?: string[] | null;
};

export function DashboardShell({
  children,
  userRole,
  displayName,
  displayRole,
  userId,
  avatarUrl,
  allowedModules,
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
    <SWRProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar
            userRole={userRole}
            displayName={displayName}
            displayRole={displayRole}
            avatarUrl={avatarUrl}
            allowedModules={allowedModules}
            onLogout={handleLogout}
          />
          <SidebarInset className="min-w-0">
            <TopNavbar displayName={displayName} displayRole={displayRole} userId={userId} avatarUrl={avatarUrl} />
            <main className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">
              {children}
            </main>
          </SidebarInset>
          <MobileBottomNav userRole={userRole} allowedModules={allowedModules} />
        </SidebarProvider>
      </TooltipProvider>
    </SWRProvider>
  );
}
