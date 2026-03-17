import { redirect } from "next/navigation";
import { getCurrentUserWithAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@/lib/constants";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getCurrentUserWithAuth();

  if (!result) {
    redirect("/login");
  }

  const { profile, auth } = result;
  const displayName = auth.operatorName || profile.full_name || profile.email || "";
  const userRole = profile.role as UserRole;
  const effectiveUserId = auth.operatorId || profile.user_id;

  return (
    <DashboardShell
      userRole={userRole}
      displayName={displayName}
      displayRole={userRole}
      userId={effectiveUserId}
      avatarUrl={profile.avatar_url}
      allowedModules={profile.allowed_modules ?? null}
    >
      {children}
    </DashboardShell>
  );
}
