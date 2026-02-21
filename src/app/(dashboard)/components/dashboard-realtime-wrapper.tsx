"use client";

import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

export function DashboardRealtimeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  useDashboardRealtime();
  return <>{children}</>;
}
