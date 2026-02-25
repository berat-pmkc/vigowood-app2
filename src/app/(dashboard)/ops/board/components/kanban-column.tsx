"use client";

import { useDroppable } from "@dnd-kit/core";
import type { TaskStatus } from "@/lib/constants";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  colors: { bg: string; text: string; border: string };
  count: number;
  children: React.ReactNode;
}

export function KanbanColumn({
  status,
  label,
  colors,
  count,
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] min-w-[180px] flex-1 flex-col rounded-lg border ${
        isOver ? "border-vw-primary bg-vw-light/50 ring-2 ring-vw-primary/30" : "border-border bg-muted/30"
      } transition-colors`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}
        {count === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">Görev yok</p>
          </div>
        )}
      </div>
    </div>
  );
}
