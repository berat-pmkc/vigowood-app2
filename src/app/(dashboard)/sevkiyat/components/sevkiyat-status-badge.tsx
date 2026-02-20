"use client";

import { Badge } from "@/components/ui/badge";
import { SEVKIYAT_STATUS_LABELS, SEVKIYAT_STATUS_COLORS, type SevkiyatStatus } from "@/lib/constants";

interface SevkiyatStatusBadgeProps {
  durum: string;
  className?: string;
}

export function SevkiyatStatusBadge({ durum, className }: SevkiyatStatusBadgeProps) {
  const status = durum as SevkiyatStatus;
  const colors = SEVKIYAT_STATUS_COLORS[status] ?? SEVKIYAT_STATUS_COLORS.bekliyor;
  const label = SEVKIYAT_STATUS_LABELS[status] ?? durum;

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} font-medium ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
