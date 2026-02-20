"use client";

import { Badge } from "@/components/ui/badge";
import { CUT_STATUS_LABELS, CUT_STATUS_COLORS, type CutStatus } from "@/lib/constants";

interface KesimStatusBadgeProps {
  durum: string;
  className?: string;
}

export function KesimStatusBadge({ durum, className }: KesimStatusBadgeProps) {
  const status = durum as CutStatus;
  const colors = CUT_STATUS_COLORS[status] ?? CUT_STATUS_COLORS.bekliyor;
  const label = CUT_STATUS_LABELS[status] ?? durum;

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} font-medium ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
