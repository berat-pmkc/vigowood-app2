import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { getEkSeanslarAralikHat } from "@/lib/talimat/planlayici-hat";
import { trBugun } from "@/lib/periods";
import { EkSeanslarClient } from "./ek-seanslar-client";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function EkSeanslarPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string; from?: string; to?: string; personel?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(TALIMAT_VIEW_ROLES as readonly string[]).includes(user.role as string)) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</div>;
  }
  const sp = await searchParams;
  const bugun = trBugun();
  const aralikMi = !!sp.from && !!sp.to && ISO.test(sp.from) && ISO.test(sp.to);
  const gun = sp.gun && ISO.test(sp.gun) ? sp.gun : bugun;
  const from = aralikMi ? sp.from! : gun;
  const to = aralikMi ? sp.to! : gun;
  const personel = sp.personel && /^[A-Za-z0-9_-]{1,32}$/.test(sp.personel) ? sp.personel : null;

  let hata: string | null = null;
  let satirlar: Awaited<ReturnType<typeof getEkSeanslarAralikHat>> = [];
  try {
    satirlar = await getEkSeanslarAralikHat(from, to, personel);
  } catch (e) {
    hata = e instanceof Error ? e.message : "Veri alınamadı";
  }

  return (
    <EkSeanslarClient
      satirlar={satirlar}
      hata={hata}
      gun={gun}
      bugun={bugun}
      aralik={aralikMi ? { from, to } : null}
      personelFiltre={personel}
    />
  );
}
