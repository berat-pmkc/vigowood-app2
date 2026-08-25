import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMaliyetVerisi, MALIYET_ROLES } from "./actions";
import { MaliyetClient } from "./components/maliyet-client";

export const metadata: Metadata = { title: "Maliyet Analizi" };

export default async function MaliyetPage() {
  const user = await getCurrentUser();
  if (!user || !MALIYET_ROLES.includes(user.role)) redirect("/");
  const veri = await getMaliyetVerisi();
  return (
    <div className="px-4 pb-6 sm:px-6">
      <MaliyetClient veri={veri} />
    </div>
  );
}
