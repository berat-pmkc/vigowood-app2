import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { YeniPaketlemeForm } from "../components/yeni-paketleme-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function YeniPaketlemePage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="pb-20 md:pb-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/uretim/paketleme">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Paketleme Listesi
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Yeni Paketleme</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Yeni paketleme seansı oluşturun
        </p>
      </div>

      <YeniPaketlemeForm />
    </div>
  );
}
