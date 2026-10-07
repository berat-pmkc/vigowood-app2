import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStationRole } from "@/lib/constants";

/** Üretim/Hat (tablet) rolleri bu bölüme erişemez */
export default async function OfisLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isStationRole(user.role)) redirect("/");
  return <>{children}</>;
}
