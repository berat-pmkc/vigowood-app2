"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <span className="text-sm font-bold tabular-nums text-blue-600">{elapsed}</span>
  );
}

export function SessionCard({ session, onClose, onCancel }: SessionCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);

  return (
    <Card className={cn("border-l-[3px] border-l-blue-500 relative")}>
      <div className="px-3 py-2">
        {/* Header: Product + cancel */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="font-medium text-foreground truncate text-xs leading-tight">
            {session.urun_adi ?? session.sku ?? "—"}
          </p>
          <button
            onClick={() => {
              setCancelLoading(true);
              onCancel(session.session_id);
            }}
            disabled={cancelLoading}
            className="p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            title="Seansı İptal Et"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step + final badge */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
            {session.seq_no}. {session.step_name || "—"}
          </Badge>
          {session.is_final_step && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
              Son
            </Badge>
          )}
        </div>

        {/* Timer + Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            {session.start_time ? (
              <LiveTimer startTime={session.start_time} />
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs bg-vw-success hover:bg-vw-success/90 text-white"
            onClick={() => onClose(session)}
          >
            <Wrench className="w-3 h-3 mr-1" />
            Kapat
          </Button>
        </div>
      </div>
    </Card>
  );
}
