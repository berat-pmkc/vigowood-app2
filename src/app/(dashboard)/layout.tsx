import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@/lib/constants";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, station")
    .eq("auth_id", user.id)
    .single();

  // For station accounts, show selected operator name
  const operatorName = user.user_metadata?.selected_operator_name as string | undefined;
  const displayName = operatorName || profile?.full_name || user.email || "";
  const userRole = (profile?.role || "Üretim") as UserRole;
  const displayRole = userRole;

  return (
    <DashboardShell
      userRole={userRole}
      displayName={displayName}
      displayRole={displayRole}
    >
      {children}
    </DashboardShell>
  );
}
