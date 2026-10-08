import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { talepBaglantilariGetir } from "@/lib/talimat/admin-actions";
import { TALEP_CREATOR_ROLES, TALEP_KAPALI_TAMAMLANAN, TALEP_KAPALI_TAMAMLANMAYAN, TALIMAT_PLANNER_ROLES } from "@/lib/talimat/constants";
import { getDepolar } from "@/lib/talimat/queries";
import { getTalep, getTalepler } from "@/lib/talep/queries";
import type { TalepFiltre } from "@/lib/talep/types";
import { TaleplerClient, type TalepSekme } from "./talepler-client";

export const dynamic = "force-dynamic";

const TARIH = /^\d{4}-\d{2}-\d{2}$/;

export default async function TaleplerPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; baslangic?: string; bitis?: string; talep?: string; degisiklik?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = user.role as string;
  if (!(TALEP_CREATOR_ROLES as readonly string[]).includes(role)) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</div>;
  }
  const planner = (TALIMAT_PLANNER_ROLES as readonly string[]).includes(role);

  const p = await searchParams;
  const vurgu = p.talep && /^[0-9a-f-]{36}$/i.test(p.talep) ? p.talep : null;

  let sekme: TalepSekme = p.sekme === "tamamlanan" || p.sekme === "tamamlanmayan" ? p.sekme : "aktif";
  // Derin bağlantı: talep hangi sekmedeyse oraya geç (kapalı + "Kaldır"ılmış -> geçmiş; aksi halde aktif liste)
  if (vurgu) {
    const t = await getTalep(vurgu);
    if (t) {
      if (t.kapanis && t.kaldirildi_at) {
        sekme = (TALEP_KAPALI_TAMAMLANAN as readonly string[]).includes(t.kapanis) ? "tamamlanan" : "tamamlanmayan";
      } else sekme = "aktif";
    }
  }

  // Derin bağlantıda tarih filtresi hedefi gizlemesin
  const baslangic = !vurgu && p.baslangic && TARIH.test(p.baslangic) ? p.baslangic : "";
  const bitis = !vurgu && p.bitis && TARIH.test(p.bitis) ? p.bitis : "";

  const filtre: TalepFiltre = { limit: 500 };
  if (sekme === "aktif") filtre.kaldirilmamis = true;
  else {
    filtre.kapali = true;
    filtre.durumlar = [...(sekme === "tamamlanan" ? TALEP_KAPALI_TAMAMLANAN : TALEP_KAPALI_TAMAMLANMAYAN)];
    if (baslangic) filtre.baslangic = baslangic;
    if (bitis) filtre.bitis = bitis;
  }

  const [{ talepler, toplam }, depolar] = await Promise.all([
    getTalepler(filtre),
    getDepolar(),
  ]);

  const bag = await talepBaglantilariGetir(talepler.filter((t) => t.bagli_satir_sayisi > 0).map((t) => t.talep_id));

  return (
    <TaleplerClient
      sekme={sekme}
      talepler={talepler}
      toplam={toplam}
      baglantilar={bag.success ? bag.data : []}
      depolar={depolar}
      userId={user.user_id}
      planner={planner}
      baslangic={baslangic}
      bitis={bitis}
      vurgu={vurgu}
      degisiklikGoster={!!vurgu && p.degisiklik === "1"}
    />
  );
}
