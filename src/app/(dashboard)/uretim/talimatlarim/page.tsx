import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithAuth } from "@/lib/auth";
import { TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { tabletHatListeGetir } from "@/lib/talimat/hat-actions";
import { TalimatlarimClient } from "./components/talimatlarim-client";

export const metadata: Metadata = { title: "İş Talimatları" };

export default async function TalimatlarimPage({
  searchParams,
}: {
  searchParams: Promise<{ hat?: string; istasyon?: string }>;
}) {
  const ctx = await getCurrentUserWithAuth();
  if (!ctx) redirect("/login");
  if (!(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) redirect("/");

  const sp = await searchParams;
  const ilk = await tabletHatListeGetir();

  return (
    <TalimatlarimClient
      odakHatId={sp.hat || null}
      odakIstasyon={["montaj", "paketleme"].includes(sp.istasyon ?? "") ? (sp.istasyon as "montaj" | "paketleme") : null}
      baslangicListe={ilk.success ? ilk.data : null}
      baslangicHata={!ilk.success ? ilk.error : null}
    />
  );
}
