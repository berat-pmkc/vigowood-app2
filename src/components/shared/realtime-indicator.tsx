"use client";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { Wifi, WifiOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RealtimeIndicator() {
  const { isOnline } = useRealtimeStatus();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center">
          {isOnline ? (
            <Wifi className="size-4 text-vw-success" />
          ) : (
            <WifiOff className="size-4 text-vw-error animate-pulse" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isOnline ? "Canli baglanti aktif" : "Baglanti kesildi"}
      </TooltipContent>
    </Tooltip>
  );
}
