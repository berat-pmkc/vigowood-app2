"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MONTAJ_SESSION_STATUS_LABELS,
  MONTAJ_SESSION_STATUS_COLORS,
  type MontajSessionStatus,
} from "@/lib/constants";

interface MontajSessionStatusBadgeProps {
  durum: string;
}

export function MontajSessionStatusBadge({ durum }: MontajSessionStatusBadgeProps) {
  const status = durum as MontajSessionStatus;
  const label = MONTAJ_SESSION_STATUS_LABELS[status] ?? durum;
  const colors = MONTAJ_SESSION_STATUS_COLORS[status];

  if (!colors) {
    return <Badge variant="outline">{label}</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={cn(colors.bg, colors.text, colors.border, "border font-medium")}
    >
      {label}
    </Badge>
  );
}
