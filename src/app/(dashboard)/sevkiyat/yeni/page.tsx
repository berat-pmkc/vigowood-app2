import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { YeniSevkiyatForm } from "../components/yeni-sevkiyat-form";

export default async function YeniSevkiyatPage() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="pb-20 md:pb-6">
      <YeniSevkiyatForm />
    </div>
  );
}
