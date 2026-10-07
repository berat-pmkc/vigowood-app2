import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { getEkSeansToplamlari } from "@/lib/talimat/ek-seans";
import { resolvePeriod } from "@/lib/periods";
import { ToplamClient } from "./toplam-client";

export const dynamic = "force-dynamic";

export default async function EkSeansToplamPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(TALIMAT_VIEW_ROLES as readonly string[]).includes(user.role as string)) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</div>;
  }
  const sp = await searchParams;
  const izinli = ["bugun", "bu-hafta", "gecen-hafta", "bu-ay", "gecen-ay", "ozel"];
  const key = sp.period && izinli.includes(sp.period) ? sp.period : "bugun";
  const period = resolvePeriod({ period: key, from: sp.from, to: sp.to });
  const from = period.from ?? period.to ?? "";
  const to = period.to ?? from;

  let hata: string | null = null;
  let toplamlar: Awaited<ReturnType<typeof getEkSeansToplamlari>> = [];
  try {
    toplamlar = await getEkSeansToplamlari(from, to);
  } catch (e) {
    hata = e instanceof Error ? e.message : "Veri alınamadı";
  }

  return <ToplamClient toplamlar={toplamlar} hata={hata} periodKey={period.key} from={from} to={to} etiket={period.label} />;
}
