"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { parseWorkers } from "../utils";

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
  workers?: Array<{ id: string; name: string }> | string | null;
}

interface SessionCardProps {
  session: ActiveMontajSession;
  onClose: (session: ActiveMontajSession) => void;
  onCancel: (sessionId: string) => Promise<void> | void;
  canCancel: boolean;
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

export function SessionCard({ session, onClose, onCancel, canCancel }: SessionCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const skuStyle = getSkuBadgeStyle(session.sku);

  return (
    <Card className={cn("border-l-[3px] relative")} style={{ borderLeftColor: skuStyle.borderColor }}>
      <div className="px-3 py-2">
        {/* Header: SKU + cancel */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span
            className="font-bold text-xs px-1.5 py-0.5 rounded truncate"
            style={{ backgroundColor: skuStyle.backgroundColor, color: skuStyle.color }}
          >
            {session.sku}
          </span>
          {canCancel && (
            <button
              onClick={async () => {
                setCancelLoading(true);
                try {
                  // await şart: iptal başarısız olursa buton kalıcı olarak
                  // devre dışı kalmamalı, kullanıcı tekrar deneyebilmeli.
                  await onCancel(session.session_id);
                } finally {
                  setCancelLoading(false);
                }
              }}
              disabled={cancelLoading}
              className="p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
              title="Seansı İptal Et"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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

        {/* Workers */}
        {(() => {
          const workers = parseWorkers(session.workers);
          return workers && workers.length > 0 ? (
            <div className="flex items-center gap-1 mb-1.5 text-[10px] text-muted-foreground truncate">
              <Users className="w-3 h-3 shrink-0" />
              {workers.map((w) => w.name).join(", ")}
            </div>
          ) : null;
        })()}

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
