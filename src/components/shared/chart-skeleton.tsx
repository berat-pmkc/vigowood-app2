"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartSkeleton({ height = 300, className }: ChartSkeletonProps) {
  return (
    <div className={className}>
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  );
}
