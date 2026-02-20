import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { KutuList } from "./components/kutu-list";
import type { KutuSessionRow } from "./components/kutu-card";
import type { KritikStokItem } from "./components/kritik-stok-panel";

interface PageProps {
  searchParams: Promise<{ durum?: string }>;
}

export default async function KutuKoliPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedStatus = params.durum || "all";

  const supabase = await createClient();

  // Son 30 gün veya aktif olanlar
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: allSessions } = await supabase
    .from("kutu_uretim")
    .select("session_id, email, tarih, part_id, part_adi, part_type, qty, not_text, durum, operator_id, operator_name, start_time, bitis_zamani, created_at")
    .or(`durum.neq.tamamlandi,created_at.gte.${thirtyDaysAgo.toISOString()}`)
    .order("created_at", { ascending: false });

  const sessions = (allSessions ?? []) as KutuSessionRow[];

  // Durum sayaçları
  const counts: Record<string, number> = { bekliyor: 0, uretimde: 0, tamamlandi: 0 };
  sessions.forEach((s) => {
    if (counts[s.durum] !== undefined) counts[s.durum]++;
  });

  // Durum filtrele
  const filtered = selectedStatus === "all"
    ? sessions
    : sessions.filter((s) => s.durum === selectedStatus);

  // Kritik stok paneli: KUTU + KARTON parçaları
  const { data: allKutuParts } = await supabase
    .from("all_parts")
    .select("part_id, part_adi, part_type, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
    .in("part_type", ["KUTU", "KARTON"])
    .order("part_adi");

  const kritikStokItems = (allKutuParts ?? []) as KritikStokItem[];

  // Günlük özet — bugünün seansları
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => {
    const d = s.tarih ? s.tarih.split("T")[0] : s.created_at.split("T")[0];
    return d === today;
  });

  const todayCompleted = todaySessions.filter((s) => s.durum === "tamamlandi");
  const todayInProgress = todaySessions.filter((s) => s.durum === "uretimde");
  const todayTotal = todayCompleted.reduce((acc, s) => acc + s.qty, 0);

  // Parça bazlı bugünkü tamamlanan
  const partQtyMap = new Map<string, { part_id: string; part_adi: string; qty: number }>();
  todayCompleted.forEach((s) => {
    if (!s.part_id) return;
    const existing = partQtyMap.get(s.part_id);
    if (existing) {
      existing.qty += s.qty;
    } else {
      partQtyMap.set(s.part_id, {
        part_id: s.part_id,
        part_adi: s.part_adi ?? s.part_id,
        qty: s.qty,
      });
    }
  });

  const todayParts = [...partQtyMap.values()].sort((a, b) => b.qty - a.qty);

  return (
    <div className="pb-20 md:pb-6">
      <KutuList
        sessions={filtered}
        counts={counts}
        selectedStatus={selectedStatus}
        todaySummary={{
          todayTotal,
          todayCompleted: todayCompleted.length,
          todayInProgress: todayInProgress.length,
          todayParts,
        }}
        kritikStokItems={kritikStokItems}
      />
    </div>
  );
}
