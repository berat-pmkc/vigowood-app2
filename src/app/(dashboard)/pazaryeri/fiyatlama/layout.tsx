import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { FiyatlamaNav } from "./components/fiyatlama-nav";

export default async function FiyatlamaLayout({
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
      <FiyatlamaNav />
      {children}
    </div>
  );
}
