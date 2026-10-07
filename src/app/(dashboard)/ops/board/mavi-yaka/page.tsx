import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { haftaBaslangici } from "@/lib/talimat/helpers";
import { getPlanByHafta, getPlanSatirlari, getTalimatPersoneller, getUrunStoklari, getYayinlar } from "@/lib/talimat/queries";
import type { UrunStokSecenek } from "@/lib/talimat/types";
import { MaviYakaClient } from "./mavi-yaka-client";

export const dynamic = "force-dynamic";

export default async function MaviYakaPage({ searchParams }: { searchParams: Promise<{ hafta?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = user.role as string;
  if (!(TALIMAT_VIEW_ROLES as readonly string[]).includes(role)) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</div>;
  }
  const planner = (TALIMAT_PLANNER_ROLES as readonly string[]).includes(role);

  const params = await searchParams;
  const buHafta = haftaBaslangici(new Date());
  const hafta = params.hafta && /^\d{4}-\d{2}-\d{2}$/.test(params.hafta) ? haftaBaslangici(params.hafta) : buHafta;

  const [plan, personeller] = await Promise.all([getPlanByHafta(hafta), getTalimatPersoneller()]);

  const [satirlar, yayinlar] = plan
    ? await Promise.all([getPlanSatirlari(plan.plan_id), getYayinlar(plan.plan_id, 20)])
    : [[], []];

  const skular = [...new Set(satirlar.map((s) => s.sku).filter((s): s is string => !!s))];
  const stokListe = await getUrunStoklari(skular);
  const stoklar: Record<string, UrunStokSecenek["depo_stoklari"]> = {};
  for (const u of stokListe) stoklar[u.sku] = u.depo_stoklari;

  return (
    <MaviYakaClient
      hafta={hafta}
      buHafta={buHafta}
      plan={plan}
      satirlar={satirlar}
      yayinlar={yayinlar}
      personeller={personeller}
      stoklar={stoklar}
      planner={planner}
    />
  );
}
