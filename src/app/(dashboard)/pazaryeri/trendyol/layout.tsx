import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { TrendyolNav } from "./components/trendyol-nav";

export default async function TrendyolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <TrendyolNav />
      {children}
    </div>
  );
}
