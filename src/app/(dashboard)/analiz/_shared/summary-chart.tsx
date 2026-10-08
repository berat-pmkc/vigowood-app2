"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";

export type SummaryUnit = "adet" | "dk" | "%" | "plaka" | "sa" | "kişi" | "çeşit";

export interface SummaryItem {
  key: string;
  label: string;
  /** Mobil kısa etiket */
  short: string;
  href?: string;
  unit: SummaryUnit;
  /** Düşük olan daha iyi (Birim Süre, Fire) */
  lowerBetter?: boolean;
  cur: number | null;
  /** null = önceki dönem yok / hesaplanamadı */
  prev: number | null;
  /** true: odak dışı; kategori eksende kalır ama çubuk/etiket gösterilmez */
  muted?: boolean;
  /** Çubuk rengi (aşama rengi); yoksa varsayılan koyu ton */
  color?: string;
}

export interface SummaryChartProps {
  title: string;
  items: SummaryItem[];
  hasPrev: boolean;
  /** Detay sayfası bağlantılarına eklenecek sorgu (m hariç, "a=b&c=d") */
  query: string;
}

const Inner = dynamic(() => import("./summary-chart-inner"), {
  ssr: false,
  loading: () => <ChartSkeleton height={280} />,
});

export function SummaryChart({ title, ...props }: SummaryChartProps) {
  return (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-white p-3 shadow-sm sm:p-4">
      <h3 className="mb-2 text-sm font-semibold text-[#474237]">{title}</h3>
      <Inner {...props} />
    </div>
  );
}
