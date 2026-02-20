"use client";

import { Badge } from "@/components/ui/badge";
import { KUTU_STATUS_LABELS, KUTU_STATUS_COLORS, type KutuStatus } from "@/lib/constants";

interface KutuStatusBadgeProps {
  durum: string;
  className?: string;
}

export function KutuStatusBadge({ durum, className }: KutuStatusBadgeProps) {
  const status = durum as KutuStatus;
  const colors = KUTU_STATUS_COLORS[status] ?? KUTU_STATUS_COLORS.bekliyor;
  const label = KUTU_STATUS_LABELS[status] ?? durum;

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} font-medium ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
