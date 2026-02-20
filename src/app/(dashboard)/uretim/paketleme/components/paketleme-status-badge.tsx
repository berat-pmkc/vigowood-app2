"use client";

import { Badge } from "@/components/ui/badge";
import { PACK_STATUS_LABELS, PACK_STATUS_COLORS, type PackStatus } from "@/lib/constants";

interface PaketlemeStatusBadgeProps {
  durum: string;
  className?: string;
}

export function PaketlemeStatusBadge({ durum, className }: PaketlemeStatusBadgeProps) {
  const status = durum as PackStatus;
  const colors = PACK_STATUS_COLORS[status] ?? PACK_STATUS_COLORS.bekliyor;
  const label = PACK_STATUS_LABELS[status] ?? durum;

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} font-medium ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
