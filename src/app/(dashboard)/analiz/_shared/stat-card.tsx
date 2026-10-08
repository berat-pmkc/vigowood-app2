import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value?: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  /** Önceki döneme göre değişim yüzdesi; null/undefined = gösterme */
  delta?: number | null;
  /** true ise artış kötü (ör. fire, birim süre) */
  inverseDelta?: boolean;
  /** Odak dışı / verisiz: çerçeve + başlık kalır, değer "—" (soluk), sayı/alt başlık/delta yok, tıklanmaz */
  empty?: boolean;
  /** Üst kenar vurgu rengi (aşama / hat rengi); ince bir şerit olarak gösterilir */
  accent?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  href,
  topLeft,
  topCenter,
  topRight,
  delta,
  inverseDelta,
  empty,
  accent,
}: StatCardProps) {
  if (empty) {
    return (
      <div className="flex h-full min-h-[120px] flex-col rounded-xl border border-[#a99c7d]/20 bg-white p-4 opacity-60 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#a99c7d]">{title}</p>
        <div className="mt-2">
          <span className="text-2xl font-bold text-muted-foreground sm:text-3xl">—</span>
        </div>
      </div>
    );
  }
  const hasSlots = topLeft || topCenter || topRight;

  const body = (
    <div
      className={`flex h-full min-h-[120px] flex-col rounded-xl border border-[#a99c7d]/30 bg-white p-4 shadow-sm transition-all ${
        href ? "hover:border-[#cdbd9d] hover:shadow-md active:scale-[0.99]" : ""
      }`}
      style={accent ? { borderTopColor: accent, borderTopWidth: 3 } : undefined}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#a99c7d]">
        {accent && (
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        )}
        {title}
      </p>

      {hasSlots && (
        <div className="mt-2 grid grid-cols-3 items-start gap-2">
          <div className="text-left">{topLeft}</div>
          <div className="text-center">{topCenter}</div>
          <div className="text-right">{topRight}</div>
        </div>
      )}

      {value !== undefined && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-bold text-[#474237] sm:text-3xl">{value}</span>
          {delta !== undefined && delta !== null && <DeltaBadge pct={delta} inverse={inverseDelta} />}
        </div>
      )}

      {subtitle && <div className="mt-auto pt-2 text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Kart köşe alanları için etiket + değer */
export function StatSlot({
  label,
  value,
  small,
  color,
}: {
  label: string;
  value: ReactNode;
  small?: boolean;
  /** Etiketin yanında renk noktası (aşama / hat rengi) */
  color?: string;
}) {
  return (
    <div className="leading-tight">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        {color && <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </div>
      <div className={`font-bold text-[#474237] ${small ? "text-sm" : "text-lg sm:text-xl"}`}>{value}</div>
    </div>
  );
}

export function DeltaBadge({ pct, inverse }: { pct: number; inverse?: boolean }) {
  if (!isFinite(pct)) return null;
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> %0
      </span>
    );
  }
  const up = rounded > 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold"
      style={{ color: good ? "#3caa35" : "#ee7683" }}
    >
      <Icon className="h-3.5 w-3.5" />%{Math.abs(rounded).toLocaleString("tr-TR")}
    </span>
  );
}
