"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleReset } from "@/hooks/use-idle-reset";
import { FIXED_PERIODS, formatRangeText } from "@/lib/periods";

const LS_KEY = "analiz-idle-reset";

interface PeriodBarProps {
  periodKey: string;
  from: string | null;
  to: string | null;
}

export function PeriodBar({ periodKey, from, to }: PeriodBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const thisYear = new Date().getFullYear();
  const keyYear = /^q[1-4]-(\d{4})$/.exec(periodKey)?.[1];
  const [qYear, setQYear] = useState<number>(keyYear ? Number(keyYear) : thisYear);
  const [ozelOpen, setOzelOpen] = useState(periodKey === "ozel");
  const [ozelFrom, setOzelFrom] = useState(periodKey === "ozel" && from ? from : "");
  const [ozelTo, setOzelTo] = useState(periodKey === "ozel" && to ? to : "");
  const [idleReset, setIdleReset] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v !== null) setIdleReset(v === "1");
    } catch {
      /* yoksay */
    }
  }, []);

  useIdleReset(idleReset);

  function toggleIdle(v: boolean) {
    setIdleReset(v);
    try {
      localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* yoksay */
    }
  }

  function go(key: string, extra?: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", key);
    params.delete("from");
    params.delete("to");
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
      active
        ? "border-[#cdbd9d] bg-[#cdbd9d] text-[#474237] shadow-sm"
        : "border-[#a99c7d]/40 bg-white text-[#5e5747] hover:bg-[#f0ede1]"
    }`;

  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
  if (!years.includes(qYear)) years.push(qYear);

  return (
    <div className="space-y-2">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FIXED_PERIODS.slice(0, 6).map((p) => (
          <button key={p.key} type="button" className={chip(periodKey === p.key)} onClick={() => go(p.key)}>
            {p.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px shrink-0 bg-[#a99c7d]/40" />

        {[1, 2, 3, 4].map((q) => {
          const k = `q${q}-${qYear}`;
          return (
            <button key={k} type="button" className={chip(periodKey === k)} onClick={() => go(k)}>
              Q{q}
            </button>
          );
        })}
        <select
          aria-label="Çeyrek yılı"
          value={qYear}
          onChange={(e) => {
            const y = Number(e.target.value);
            setQYear(y);
            if (/^q[1-4]-/.test(periodKey)) go(`${periodKey.slice(0, 3)}${y}`);
          }}
          className="shrink-0 rounded-md border border-[#a99c7d]/40 bg-white px-1.5 py-1 text-xs text-[#5e5747]"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px shrink-0 bg-[#a99c7d]/40" />

        {FIXED_PERIODS.slice(6).map((p) => (
          <button key={p.key} type="button" className={chip(periodKey === p.key)} onClick={() => go(p.key)}>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={chip(periodKey === "ozel" || ozelOpen)}
          onClick={() => setOzelOpen((v) => !v)}
        >
          Özel
        </button>
      </div>

      {ozelOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#a99c7d]/40 bg-white p-2">
          <input
            type="date"
            value={ozelFrom}
            onChange={(e) => setOzelFrom(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
            aria-label="Başlangıç"
          />
          <span className="text-sm text-muted-foreground">–</span>
          <input
            type="date"
            value={ozelTo}
            onChange={(e) => setOzelTo(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
            aria-label="Bitiş"
          />
          <Button
            size="sm"
            disabled={!ozelFrom || !ozelTo}
            onClick={() => go("ozel", { from: ozelFrom, to: ozelTo })}
            className="bg-[#cdbd9d] text-[#474237] hover:bg-[#a99c7d]"
          >
            Uygula
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-[#5e5747]">{formatRangeText(from, to)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={idleReset}
              onChange={(e) => toggleIdle(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#a99c7d]"
            />
            5 dk işlem yoksa filtreleri sıfırla
          </label>
          <Button variant="outline" size="sm" onClick={() => router.replace(pathname)} className="h-8 gap-1.5 text-xs">
            <FilterX className="h-3.5 w-3.5" />
            Filtreyi Kaldır
          </Button>
        </div>
      </div>
    </div>
  );
}
