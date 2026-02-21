import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth";
import { FirmalarClient } from "./components/firmalar-client";
import type { SevkiyatFirmaRow } from "@/app/(dashboard)/sevkiyat/actions";

export default async function FirmalarPage() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("sevkiyat_firmalar")
    .select("*")
    .order("firma_tipi")
    .order("profil_adi");

  const firmalar = (data ?? []) as SevkiyatFirmaRow[];

  return <FirmalarClient firmalar={firmalar} />;
}
