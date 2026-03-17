import type { Metadata } from "next";
import { getCachedMachines } from "@/lib/cached-queries";
import { createClient } from "@/lib/supabase/server";
import { MakinelerTable } from "./components/makineler-table";
import type { BakimLogRow } from "./components/bakim-gecmisi-table";

export const metadata: Metadata = { title: "Makine Yönetimi" };

interface PageProps {
  searchParams: Promise<{
    view?: string;
    makine?: string;
    durum?: string;
    sayfa?: string;
    pageSize?: string;
  }>;
}

export default async function MakinelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = (params.view === "bakimlar" ? "bakimlar" : "liste") as "liste" | "bakimlar";

  const makineler = await getCachedMachines();

  if (view === "bakimlar") {
    const page = Math.max(0, Number(params.sayfa || "0"));
    const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
      ? Number(params.pageSize || "25")
      : 25;
    const makineFilter = params.makine || "";
    const durumFilter = params.durum || "";

    const supabase = await createClient();

    // Count + paginated query
    let query = supabase
      .from("makine_durum_log")
      .select("*", { count: "exact" });

    if (makineFilter) query = query.eq("makine_id", makineFilter);
    if (durumFilter) query = query.eq("durum", durumFilter);

    const from = page * pageSize;
    const { data: logs, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    const totalCount = count ?? 0;
    const logRows = (logs ?? []) as Array<{
      id: string;
      makine_id: string;
      durum: string;
      neden: string | null;
      degistiren: string | null;
      created_at: string;
    }>;

    // Get all unique makine_ids from the page for duration calculation
    const uniqueMakineIds = [...new Set(logRows.map((r) => r.makine_id))];

    // For each log entry, find the next entry for the same machine to calculate duration
    // Fetch all logs for these machines (they typically have very few entries each)
    let allLogsForMachines: typeof logRows = [];
    if (uniqueMakineIds.length > 0) {
      const { data: allLogs } = await supabase
        .from("makine_durum_log")
        .select("id, makine_id, created_at")
        .in("makine_id", uniqueMakineIds)
        .order("created_at", { ascending: true });
      allLogsForMachines = (allLogs ?? []) as typeof logRows;
    }

    // Build a map: logId -> next log's created_at for the same machine
    const machineLogsByMachine = new Map<string, Array<{ id: string; created_at: string }>>();
    for (const log of allLogsForMachines) {
      const arr = machineLogsByMachine.get(log.makine_id) ?? [];
      arr.push({ id: log.id, created_at: log.created_at });
      machineLogsByMachine.set(log.makine_id, arr);
    }

    const durationMap = new Map<string, number | null>();
    for (const [, entries] of machineLogsByMachine) {
      for (let i = 0; i < entries.length; i++) {
        const current = entries[i];
        const next = entries[i + 1];
        if (next) {
          durationMap.set(
            current.id,
            new Date(next.created_at).getTime() - new Date(current.created_at).getTime()
          );
        } else {
          durationMap.set(current.id, null); // last entry = ongoing
        }
      }
    }

    // Resolve degistiren user IDs to names
    const degistirenIds = [...new Set(logRows.map((r) => r.degistiren).filter(Boolean))] as string[];
    const userNames: Record<string, string> = {};
    if (degistirenIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("user_id, full_name")
        .in("user_id", degistirenIds);
      for (const u of users ?? []) {
        userNames[u.user_id] = u.full_name;
      }
    }

    // Unique makine list for filter dropdown
    const { data: allMachines } = await supabase
      .from("kesim_makinesi")
      .select("makine_id")
      .order("makine_id");
    const makineOptions = (allMachines ?? []).map((m) => m.makine_id);

    const bakimData: BakimLogRow[] = logRows.map((row) => ({
      ...row,
      sure_ms: durationMap.get(row.id) ?? null,
    }));

    return (
      <div className="px-4 pb-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Makine Yönetimi</h1>
          <p className="text-sm text-muted-foreground">
            Üretim makinelerini yönetin ve bakım geçmişini inceleyin.
          </p>
        </div>
        <MakinelerTable
          data={(makineler as any[]) ?? []}
          view="bakimlar"
          bakimData={bakimData}
          bakimTotalCount={totalCount}
          bakimPage={page}
          bakimPageSize={pageSize}
          bakimMakineFilter={makineFilter}
          bakimDurumFilter={durumFilter}
          makineOptions={makineOptions}
          userNames={userNames}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Makine Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Üretim makinelerini yönetin ve bakım geçmişini inceleyin.
        </p>
      </div>
      <MakinelerTable data={(makineler as any[]) ?? []} view="liste" />
    </div>
  );
}
