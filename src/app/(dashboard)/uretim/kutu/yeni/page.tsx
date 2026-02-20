import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { YeniKutuForm } from "../components/yeni-kutu-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function YeniKutuPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="pb-20 md:pb-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/uretim/kutu">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Kutu-Koli Listesi
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Yeni Kutu-Koli Üretimi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Yeni kutu veya karton üretim seansı oluşturun
        </p>
      </div>

      <YeniKutuForm />
    </div>
  );
}
