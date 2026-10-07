"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin ağaç görünümleri (Plakalar > Liste / Parçalar) için ortak satır.
 * level 0 = ürün, 1 = plaka, 2 = parça. Girinti + sol çizgi ile hiyerarşi belli olur.
 */
const LEVEL_STYLE: Record<0 | 1 | 2, string> = {
  0: "bg-muted/60 font-medium",
  1: "bg-background ml-3 sm:ml-6 border-l-2 border-l-primary/40",
  2: "bg-background ml-6 sm:ml-12 border-l-2 border-l-muted-foreground/30 text-sm",
};

interface TreeRowProps {
  level: 0 | 1 | 2;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  highlighted?: boolean;
  /** Satırın ana içeriği (esnek) */
  children: ReactNode;
  /** Sağdaki aksiyon butonları */
  actions?: ReactNode;
}

export function TreeRow({
  level,
  hasChildren,
  expanded,
  onToggle,
  highlighted,
  children,
  actions,
}: TreeRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 min-h-11",
        LEVEL_STYLE[level],
        highlighted && "ring-1 ring-vw-warning/60 bg-vw-warning/10"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasChildren}
        aria-label={expanded ? "Daralt" : "Genişlet"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-accent",
          !hasChildren && "invisible"
        )}
      >
        <ChevronRight
          className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")}
        />
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Arama eşleşmesini sarı vurgular. */
export function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const i = text.toLocaleLowerCase("tr").indexOf(q.toLocaleLowerCase("tr"));
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-vw-warning/30 px-0.5 text-inherit">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}
