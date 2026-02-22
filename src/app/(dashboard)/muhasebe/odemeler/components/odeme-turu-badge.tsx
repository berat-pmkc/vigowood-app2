"use client";

import { ODEME_TURU_COLORS, type OdemeTuruConst } from "@/lib/constants";

interface OdemeTuruBadgeProps {
  turu: string | null;
}

export function OdemeTuruBadge({ turu }: OdemeTuruBadgeProps) {
  if (!turu) return <span className="text-muted-foreground">—</span>;

  const colors = ODEME_TURU_COLORS[turu as OdemeTuruConst];
  if (!colors) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        {turu}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {turu}
    </span>
  );
}
