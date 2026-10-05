import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Filter } from "lucide-react";
import type { ResolvedPeriod } from "@/lib/periods";
import { PeriodBar } from "./period-bar";
import { MetricChips, type MetricChip } from "./metric-chips";
import { FocusBadge } from "./focus-badge";

interface AnalizLayoutProps {
  title: string;
  /** Alt sayfalarda geri bağlantısı (ör. "/analiz") */
  backHref?: string;
  period: ResolvedPeriod;
  chips?: MetricChip[];
  activeMetric?: string;
  chart?: ReactNode;
  /** StatCard'lar; grid içinde render edilir */
  cards?: ReactNode;
  list?: ReactNode;
  /** Kartlar grid sütun sınıfı (varsayılan 1/2/3/4 sütun) */
  cardsClassName?: string;
  /** Kolon filtresi aktifse: "Filtre uygulandı: ..." notu (kart ve grafikler filtrelenmiştir) */
  filterNote?: string | null;
  /** Odak modu: "Odak: ..." etiketleri ve × ile silinecek URL parametreleri */
  focus?: { labels: string[]; clearKeys: string[] } | null;
}

export function AnalizLayout({
  title,
  backHref,
  period,
  chips,
  activeMetric,
  chart,
  cards,
  list,
  cardsClassName = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
  filterNote,
  focus,
}: AnalizLayoutProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Geri"
            className="rounded-md p-1.5 text-[#5e5747] hover:bg-[#f0ede1]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <h1 className="text-xl font-bold text-[#474237] sm:text-2xl">{title}</h1>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
        <PeriodBar periodKey={period.key} from={period.from} to={period.to} />
      </Suspense>

      {filterNote && (
        <p className="flex items-start gap-1.5 rounded-lg border border-[#3368b1]/30 bg-[#3368b1]/5 px-3 py-1.5 text-xs font-medium text-[#3368b1]">
          <Filter className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="#3368b1" />
          <span>{filterNote} — kartlar ve grafik filtreye göre hesaplanır</span>
        </p>
      )}

      {focus && focus.labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <FocusBadge labels={focus.labels} clearKeys={focus.clearKeys} />
          </Suspense>
        </div>
      )}

      {chips && chips.length > 0 && (
        <Suspense fallback={<div className="h-9 animate-pulse rounded-lg bg-muted" />}>
          <MetricChips chips={chips} active={activeMetric} />
        </Suspense>
      )}

      {chart}
      {cards && <div className={cardsClassName}>{cards}</div>}
      {list}
    </div>
  );
}
