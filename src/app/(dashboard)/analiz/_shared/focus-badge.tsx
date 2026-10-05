"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crosshair, X } from "lucide-react";

interface FocusBadgeProps {
  labels: string[];
  /** Temizlenecek URL parametreleri (m, f.*) */
  clearKeys: string[];
}

export function FocusBadge({ labels, clearKeys }: FocusBadgeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of clearKeys) params.delete(k);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#5e5747]/30 bg-[#f0ede1] py-0.5 pl-2.5 pr-1 text-xs font-semibold text-[#474237]">
      <Crosshair className="h-3 w-3" />
      Odak: {labels.join(" · ")}
      <button
        type="button"
        aria-label="Odağı kaldır"
        onClick={clear}
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#cdbd9d]/50"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
