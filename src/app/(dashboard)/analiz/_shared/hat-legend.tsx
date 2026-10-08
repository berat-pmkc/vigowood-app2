import { HatNokta } from "@/components/shared/hat-nokta";
import { fmtNum } from "./utils";

export interface HatLegendItem {
  id: string;
  ad: string;
  /** Atanmamış = null (nötr renkli nokta) */
  sira: number | null;
  value?: number;
}

/** Hat renk göstergesi: noktalı küçük etiketler (isteğe bağlı değerle) */
export function HatLegend({
  items,
  title,
  compact,
}: {
  items: HatLegendItem[];
  title?: string;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? "text-[11px]" : "px-1 pt-2 text-xs"} text-[#5e5747]`}
    >
      {title && <span className="font-semibold text-[#474237]">{title}</span>}
      {items.map((it) => (
        <span key={it.id} className="inline-flex items-center gap-1.5">
          <HatNokta hat={it.sira === null ? null : { sira: it.sira }} />
          <span>{it.ad}</span>
          {it.value !== undefined && <span className="font-semibold tabular-nums text-[#474237]">{fmtNum(it.value)}</span>}
        </span>
      ))}
    </div>
  );
}
