"use client";

import { type Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
  onSort?: (columnId: string, desc: boolean) => void;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  onSort,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[state=open]:bg-accent", className)}
      onClick={() => {
        const nextDesc = sorted === "asc";
        if (onSort) {
          onSort(column.id, nextDesc);
        } else {
          column.toggleSorting(nextDesc);
        }
      }}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDown className="ml-1 h-4 w-4" />
      ) : sorted === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground/50" />
      )}
    </Button>
  );
}
