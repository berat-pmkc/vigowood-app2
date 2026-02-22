"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MontajSessionStatusBadge } from "./montaj-session-status-badge";
import { Clock, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveMontajSession {
  session_id: string;
  sku: string;
  urun_adi?: string;
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  start_time: string | null;
  durum: string;
  operator_name: string | null;
}

interface SessionCardProps {
  session: ActiveMontajSession;
  onClose: (session: ActiveMontajSession) => void;
  onCancel: (sessionId: string) => void;
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(startTime).getTime();
      if (diff < 0) return "0dk";
      const totalMin = Math.floor(diff / 60000);
      const hours = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      if (hours > 0) return `${hours}s ${mins}dk`;
      return `${mins}dk`;
    };

    setElapsed(calc());
    const interval = setInterval(() => setElapsed(calc()), 60000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-lg font-bold tabular-nums text-blue-600">{elapsed}</span>
  );
}

export function SessionCard({ session, onClose, onCancel }: SessionCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);

  return (
    <Card className={cn("border-l-4 border-l-blue-500 relative")}>
      <div className="p-4">
        {/* Cancel button */}
        <button
          onClick={() => {
            setCancelLoading(true);
            onCancel(session.session_id);
          }}
          disabled={cancelLoading}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Seansı iptal et"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product name */}
        <div className="mb-2 pr-6">
          <p className="font-medium text-foreground truncate text-sm">
            {session.urun_adi ?? session.sku ?? "—"}
          </p>
          {session.sku && session.urun_adi && (
            <p className="text-xs text-muted-foreground">{session.sku}</p>
          )}
        </div>

        {/* Step badge */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            Adım {session.seq_no}: {session.step_name || "—"}
          </Badge>
          {session.is_final_step && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              Son Adım
            </Badge>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-blue-500" />
          {session.start_time ? (
            <LiveTimer startTime={session.start_time} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Operator */}
        {session.operator_name && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            {session.operator_name}
          </p>
        )}

        {/* Status + Close button */}
        <div className="flex items-center justify-between">
          <MontajSessionStatusBadge durum={session.durum} />
          <Button
            size="sm"
            className="h-9 px-3 bg-vw-success hover:bg-vw-success/90 text-white"
            onClick={() => onClose(session)}
          >
            <Wrench className="w-4 h-4 mr-1" />
            Kapat
          </Button>
        </div>
      </div>
    </Card>
  );
}
