"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";

export interface AnalizSeries {
  key: string;
  label: string;
  color?: string;
  /** composed grafikte seri tipi (varsayılan bar) */
  type?: "bar" | "line";
  /** composed/line/area/bar(yatay) grafiklerde çift eksen */
  yAxisId?: "left" | "right";
}

export interface AnalizChartProps {
  type?: "bar" | "line" | "area" | "composed";
  data: Record<string, string | number | null>[];
  xKey: string;
  series: AnalizSeries[];
  /** "vertical" = yatay çubuklar (kategori Y ekseninde) */
  layout?: "horizontal" | "vertical";
  height?: number;
  /** Tooltip birim eki, ör. " dk" veya "%" */
  unit?: string;
  stacked?: boolean;
  title?: string;
  emptyText?: string;
}

const Inner = dynamic(() => import("./analiz-chart-inner"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});

export function AnalizChart({ title, emptyText = "Bu dönemde veri yok", ...props }: AnalizChartProps) {
  const empty = props.data.length === 0;
  const height =
    props.layout === "vertical"
      ? Math.max(props.height ?? 300, props.data.length * 32 + 40)
      : (props.height ?? 300);

  return (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-white p-3 shadow-sm sm:p-4">
      {title && <h3 className="mb-2 text-sm font-semibold text-[#474237]">{title}</h3>}
      {empty ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <Inner {...props} height={height} />
      )}
    </div>
  );
}
