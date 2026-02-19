import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/shared/logout-button";

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
  const operatorName = user.user_metadata?.selected_operator_name;
  const displayName = operatorName || profile?.full_name || user.email;
  const displayRole = profile?.role || "";

  return (
    <div className="min-h-screen bg-vw-light">
      {/* Temporary top bar — will be replaced by Sidebar/Navbar in Katman 2 */}
      <header className="flex items-center justify-between border-b border-vw-side/20 bg-vw-dark px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vw-primary">
            <span className="text-sm font-bold text-vw-dark">VW</span>
          </div>
          <span className="text-sm font-semibold text-vw-light">VigoWood</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-vw-light">{displayName}</p>
            <p className="text-xs text-vw-side">{displayRole}</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
