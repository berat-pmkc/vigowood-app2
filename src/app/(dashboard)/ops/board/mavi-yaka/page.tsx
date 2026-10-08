import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { talimatPasifKayitlari } from "@/lib/talimat/actions";
import { TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { rpcCagir } from "@/lib/talimat/db";
import { haftaBaslangici } from "@/lib/talimat/helpers";
import { getPlanByHafta, getHatlar, getPlanSatirlari, getUrunStoklari, getYayinlar } from "@/lib/talimat/queries";
import type { UrunStokSecenek } from "@/lib/talimat/types";
import { MaviYakaClient } from "./mavi-yaka-client";

export const dynamic = "force-dynamic";

export default async function MaviYakaPage({ searchParams }: { searchParams: Promise<{ hafta?: string; satir?: string }> }) {
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

  const [plan, hatlar] = await Promise.all([getPlanByHafta(hafta), getHatlar({ sadeceAktif: false })]);

  // Hat sistemi öncesi oluşturulmuş ya da sonradan hat eklenmiş planlarda her aktif hatta
  // en az bir boş satır olsun (yalnızca planlayıcı, pasif olmayan planda; satır ekler, silmez).
  if (plan && planner && plan.durum !== "pasif") {
    try {
      await rpcCagir<number>("talimat_plan_hat_satirlari_hazirla", { p_plan: plan.plan_id });
    } catch (e) {
      console.error("[mavi-yaka] hat satırları hazırlanamadı", e);
    }
  }

  const [satirlar, yayinlar, pasifKayitlari] = plan
    ? await Promise.all([
        getPlanSatirlari(plan.plan_id, { sadeceHat: true }),
        getYayinlar(plan.plan_id, 20),
        talimatPasifKayitlari(plan.plan_id),
      ])
    : [[], [], []];
  const vurguSatir = params.satir && /^[0-9a-f-]{36}$/i.test(params.satir) ? params.satir : null;

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
      hatlar={hatlar}
      stoklar={stoklar}
      planner={planner}
      pasifKayitlari={pasifKayitlari}
      vurguSatir={vurguSatir}
    />
  );
}
