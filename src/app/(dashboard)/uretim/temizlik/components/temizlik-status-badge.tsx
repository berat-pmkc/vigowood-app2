"use client";

import { Badge } from "@/components/ui/badge";
import { CLEAN_STATUS_COLORS, CLEAN_STATUS_LABELS, type CleanStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TemizlikStatusBadgeProps {
  status: string;
}

export function TemizlikStatusBadge({ status }: TemizlikStatusBadgeProps) {
  const s = status as CleanStatus;
  const colors = CLEAN_STATUS_COLORS[s] ?? CLEAN_STATUS_COLORS.bekliyor;
  const label = CLEAN_STATUS_LABELS[s] ?? status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {label}
    </Badge>
  );
}
