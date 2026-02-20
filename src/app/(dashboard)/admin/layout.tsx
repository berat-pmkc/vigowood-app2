import { redirect } from "next/navigation";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { AdminNav } from "./components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <AdminNav />
      {children}
    </div>
  );
}
