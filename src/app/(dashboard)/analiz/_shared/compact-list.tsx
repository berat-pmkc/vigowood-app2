"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsDown } from "lucide-react";
import { GRANULARITY_LABELS, type Granularity } from "@/lib/periods";

export interface CompactColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /** number: tr-TR sayı, dk: 1 ondalık + " dk", percent: %x, text: olduğu gibi */
  format?: "text" | "number" | "dk" | "percent";
}

export type CompactRow = Record<string, string | number | null>;

interface CompactListProps {
  title?: string;
  columns: CompactColumn[];
  rows: CompactRow[];
  /** Günlük/Haftalık/Aylık/Yıllık seçici gösterilsin (?g=) */
  showGrouping?: boolean;
  activeGranularity?: Granularity;
  emptyText?: string;
}

const FIRST = 5;
const STEP = 10;

function fmt(v: string | number | null, f: CompactColumn["format"]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  switch (f) {
    case "dk":
      return `${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} dk`;
    case "percent":
      return `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
    default:
      return v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  }
}

export function CompactList({
  title,
  columns,
  rows,
  showGrouping,
  activeGranularity,
  emptyText = "Bu dönemde kayıt yok",
}: CompactListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(FIRST);

  const allShown = visible >= rows.length;
  const g = activeGranularity ?? (searchParams.get("g") as Granularity | null);

  function setGranularity(next: Granularity) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("g", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-white shadow-sm">
      {(title || showGrouping) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#a99c7d]/20 px-4 py-2.5">
          {title ? <h3 className="text-sm font-semibold text-[#474237]">{title}</h3> : <span />}
          {showGrouping && (
            <div className="flex overflow-hidden rounded-md border border-[#a99c7d]/40">
              {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGranularity(k)}
                  className={`px-2.5 py-1 text-xs font-medium ${
                    g === k ? "bg-[#cdbd9d] text-[#474237]" : "bg-white text-[#5e5747] hover:bg-[#f0ede1]"
                  }`}
                >
                  {GRANULARITY_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-[#a99c7d]/20 text-xs text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-2 font-medium ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.slice(0, visible).map((r, i) => (
              <tr key={i} className="border-b border-[#a99c7d]/10 last:border-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-4 py-1.5 ${
                      c.align === "right" ? "text-right tabular-nums" : "text-left"
                    }`}
                  >
                    {fmt(r[c.key] ?? null, c.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > FIRST && (
        <button
          type="button"
          disabled={allShown}
          onClick={() => setVisible((v) => v + STEP)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-[#a99c7d]/20 px-4 py-2 text-sm font-medium disabled:cursor-default"
          style={{ color: allShown ? "#9ca3af" : "#3368b1" }}
        >
          <ChevronsDown className="h-4 w-4" />
          {allShown ? "Tümü gösterildi" : `Devamını göster (+${Math.min(STEP, rows.length - visible)})`}
        </button>
      )}
    </div>
  );
}
