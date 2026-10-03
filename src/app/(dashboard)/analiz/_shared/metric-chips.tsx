"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface MetricChip {
  key: string;
  label: string;
}

interface MetricChipsProps {
  chips: MetricChip[];
  /** URL parametresi (varsayılan "m") */
  param?: string;
  /** Aktif anahtar; yoksa URL'den, o da yoksa ilk chip */
  active?: string;
}

export function MetricChips({ chips, param = "m", active }: MetricChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = active ?? searchParams.get(param) ?? chips[0]?.key;

  function select(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {chips.map((c) => {
        const isActive = c.key === current;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => select(c.key)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              isActive
                ? "bg-[#474237] text-white"
                : "bg-[#f0ede1] text-[#5e5747] hover:bg-[#cdbd9d]/50"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
