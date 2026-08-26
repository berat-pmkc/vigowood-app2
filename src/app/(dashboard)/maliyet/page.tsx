import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMaliyetVerisi } from "./actions";
import { MALIYET_ROLES } from "./constants";
import { MaliyetClient } from "./components/maliyet-client";

export const metadata: Metadata = { title: "Maliyet Analizi" };

export default async function MaliyetPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !MALIYET_ROLES.includes(user.role)) redirect("/");
  const { ay } = await searchParams;
  const veri = await getMaliyetVerisi(ay ?? null);
  return (
    <div className="px-4 pb-6 sm:px-6">
      <MaliyetClient veri={veri} />
    </div>
  );
}
