import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithAuth } from "@/lib/auth";
import { TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { tabletListeGetir } from "@/lib/talimat/actions";
import { tabletKontekstGetir } from "@/lib/talimat/tablet-actions";
import { TalimatlarimClient } from "./components/talimatlarim-client";

export const metadata: Metadata = { title: "İş Talimatları" };

export default async function TalimatlarimPage({
  searchParams,
}: {
  searchParams: Promise<{ personel?: string }>;
}) {
  const ctx = await getCurrentUserWithAuth();
  if (!ctx) redirect("/login");
  if (!(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) redirect("/");

  const sp = await searchParams;
  const kr = await tabletKontekstGetir();
  if (!kr.success) redirect("/");
  const kontekst = kr.data;

  // Varsayılan: URL'deki personel, yoksa seçili operatör
  const personelId = sp.personel || kontekst.varsayilanPersonelId || null;
  const ilk = personelId ? await tabletListeGetir(personelId) : null;

  return (
    <TalimatlarimClient
      personeller={kontekst.personeller}
      baslangicPersonelId={personelId}
      baslangicListe={ilk && ilk.success ? ilk.data : null}
      baslangicHata={ilk && !ilk.success ? ilk.error : null}
    />
  );
}
