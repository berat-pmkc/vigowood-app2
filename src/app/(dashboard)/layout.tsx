import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect("/login");
  }

  // For station accounts, show selected operator name
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const operatorId = user?.user_metadata?.selected_operator_id as string | undefined;
  const operatorName = user?.user_metadata?.selected_operator_name as string | undefined;
  const displayName = operatorName || profile.full_name || profile.email || "";
  const userRole = profile.role as UserRole;
  const effectiveUserId = operatorId || profile.user_id;

  return (
    <DashboardShell
      userRole={userRole}
      displayName={displayName}
      displayRole={userRole}
      userId={effectiveUserId}
    >
      {children}
    </DashboardShell>
  );
}
