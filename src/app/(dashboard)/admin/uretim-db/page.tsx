import type { Metadata } from "next";
import { fetchCutBatches, fetchMontajSessions, fetchPackEvents } from "./actions";
import { UretimDbTabs } from "./components/uretim-db-tabs";
import type { CutBatch, MontajSession, PackEvent } from "@/lib/supabase/types";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    durum?: string;
    makine?: string;
    dateFrom?: string;
    dateTo?: string;
    operator?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Üretim Veritabanı" };
export const revalidate = 30;

const VALID_TABS = ["kesim", "montaj", "paketleme"] as const;

export default async function UretimDbPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const tab = VALID_TABS.includes(params.tab as typeof VALID_TABS[number])
    ? (params.tab as typeof VALID_TABS[number])
    : "kesim";

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "50"))
    ? Number(params.pageSize || "50")
    : 50;
  const search = params.search?.trim() || "";
  const durum = params.durum || "";
  const makine = params.makine || "";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";
  const operator = params.operator || "";
  const sortBy = params.sortBy || "";
  const sortOrder = params.sortOrder === "asc";

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Fetch data only for the active tab
  let kesimData: CutBatch[] = [];
  let kesimCount = 0;
  let montajData: MontajSession[] = [];
  let montajCount = 0;
  let paketlemeData: PackEvent[] = [];
  let paketlemeCount = 0;

  try {
    if (tab === "kesim") {
      const validColumns = ["cut_id", "tarih", "sku", "plaka_id", "makine_id", "adet", "operator_id", "durum", "baslama_zamani", "bitis_zamani", "created_at"];
      const sortColumn = validColumns.includes(sortBy) ? sortBy : "tarih";
      const result = await fetchCutBatches({
        search, durum, makine, dateFrom, dateTo, operator,
        sortColumn, sortOrder: sortBy ? sortOrder : false,
        from, to,
      });
      kesimData = result.data;
      kesimCount = result.count;
    } else if (tab === "montaj") {
      const validColumns = ["session_id", "sku", "step_name", "durum", "operator_name", "qty", "worker_count", "birim_montaj_dk", "start_time", "end_time", "created_at"];
      const sortColumn = validColumns.includes(sortBy) ? sortBy : "created_at";
      const result = await fetchMontajSessions({
        search, durum, dateFrom, dateTo, operator,
        sortColumn, sortOrder: sortBy ? sortOrder : false,
        from, to,
      });
      montajData = result.data;
      montajCount = result.count;
    } else {
      const validColumns = ["session_id", "sku", "durum", "operator_name", "qty", "worker_count", "birim_paketleme_dk", "tarih", "start_time", "end_time", "created_at"];
      const sortColumn = validColumns.includes(sortBy) ? sortBy : "created_at";
      const result = await fetchPackEvents({
        search, durum, dateFrom, dateTo, operator,
        sortColumn, sortOrder: sortBy ? sortOrder : false,
        from, to,
      });
      paketlemeData = result.data;
      paketlemeCount = result.count;
    }
  } catch {
    // Error will show empty table
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Üretim Veritabanı</h1>
        <p className="text-sm text-muted-foreground">
          Kesim, montaj ve paketleme kayıtlarını görüntüle, düzenle ve sil
        </p>
      </div>
      <UretimDbTabs
        activeTab={tab}
        kesimData={kesimData}
        kesimCount={kesimCount}
        montajData={montajData}
        montajCount={montajCount}
        paketlemeData={paketlemeData}
        paketlemeCount={paketlemeCount}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        durum={durum}
        makine={makine}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sortBy={sortBy}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
