"use client";

import { Badge } from "@/components/ui/badge";
import { MONTAJ_STATUS_LABELS, MONTAJ_STATUS_COLORS, type MontajStatus } from "@/lib/constants";

interface MontajStatusBadgeProps {
  durum: string;
  className?: string;
}

export function MontajStatusBadge({ durum, className }: MontajStatusBadgeProps) {
  const status = durum as MontajStatus;
  const colors = MONTAJ_STATUS_COLORS[status] ?? MONTAJ_STATUS_COLORS.bekliyor;
  const label = MONTAJ_STATUS_LABELS[status] ?? durum;

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} font-medium ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
