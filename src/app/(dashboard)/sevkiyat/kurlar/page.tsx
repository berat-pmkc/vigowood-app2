import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { KurlarClient } from "./kurlar-client";
import type { DovizKuruRow } from "../actions";

export const metadata: Metadata = { title: "Doviz Kurlari" };

export default async function KurlarPage() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 60);

  const { data } = await supabase
    .from("doviz_kurlari")
    .select("*")
    .gte("tarih", since.toISOString().split("T")[0])
    .order("tarih", { ascending: false });

  const kurlar = (data ?? []) as DovizKuruRow[];

  return (
    <div className="pb-20 md:pb-6">
      <KurlarClient kurlar={kurlar} />
    </div>
  );
}
