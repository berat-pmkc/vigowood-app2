"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaketlemeStatusBadge } from "./paketleme-status-badge";
import { Clock, Package, X, Pause, Play, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveSession {
  session_id: string;
  sku: string | null;
  urun_adi?: string;
  start_time: string | null;
  durum: string;
  operator_name: string | null;
  duraklama_dk?: number | null;
  duraklatma_baslangic?: string | null;
}

interface SessionCardProps {
  session: ActiveSession;
  onClose: (session: ActiveSession) => void;
  onCancel: (sessionId: string) => void;
  onToggleDuraklat: (sessionId: string) => void | Promise<void>;
}

function dkFormat(dakika: number) {
  const totalMin = Math.max(0, Math.floor(dakika));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;
}

/** Net çalışma süresi (bekleme düşülmüş) + toplam bekleme süresini canlı gösterir. */
function LiveTimer({
  startTime,
  duraklamaDk,
  duraklatmaBaslangic,
}: {
  startTime: string;
  duraklamaDk: number;
  duraklatmaBaslangic: string | null;
}) {
  const [, tick] = useState(0);
  const duraklatildi = !!duraklatmaBaslangic;

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const grossMin = (now - new Date(startTime).getTime()) / 60000;
  const acikBekleme = duraklatildi
    ? (now - new Date(duraklatmaBaslangic!).getTime()) / 60000
    : 0;
  const toplamBekleme = duraklamaDk + acikBekleme;
  const netMin = Math.max(0, grossMin - toplamBekleme);

  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "text-lg font-bold tabular-nums",
          duraklatildi ? "text-amber-600" : "text-blue-600"
        )}
      >
        {dkFormat(netMin)}
      </span>
      {toplamBekleme > 0.5 && (
        <span className="flex items-center gap-1 text-[11px] text-amber-600">
          <Timer className="h-3 w-3" />
          Bekleme: {dkFormat(toplamBekleme)}
        </span>
      )}
    </div>
  );
}

export function SessionCard({
  session,
  onClose,
  onCancel,
  onToggleDuraklat,
}: SessionCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const [duraklatLoading, setDuraklatLoading] = useState(false);
  const duraklatildi = !!session.duraklatma_baslangic;

  return (
    <Card
      className={cn(
        "relative border-l-4",
        duraklatildi ? "border-l-amber-500 bg-amber-50/40" : "border-l-blue-500"
      )}
    >
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

        {/* SKU + Product name */}
        <div className="mb-2 pr-6">
          <p className="font-medium text-foreground truncate text-sm">
            {session.sku ?? "—"}
          </p>
          {session.urun_adi && (
            <p className="text-xs text-muted-foreground truncate">{session.urun_adi}</p>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 mb-3">
          <Clock className={cn("w-4 h-4", duraklatildi ? "text-amber-500" : "text-blue-500")} />
          {session.start_time ? (
            <LiveTimer
              startTime={session.start_time}
              duraklamaDk={Number(session.duraklama_dk ?? 0)}
              duraklatmaBaslangic={session.duraklatma_baslangic ?? null}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {duraklatildi && (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Duraklatıldı
            </span>
          )}
        </div>

        {/* Status + actions */}
        <div className="flex items-center justify-between gap-2">
          <PaketlemeStatusBadge durum={session.durum} />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-9 px-2.5",
                duraklatildi
                  ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  : "border-amber-300 text-amber-700 hover:bg-amber-50"
              )}
              disabled={duraklatLoading}
              onClick={async () => {
                setDuraklatLoading(true);
                try {
                  await onToggleDuraklat(session.session_id);
                } finally {
                  setDuraklatLoading(false);
                }
              }}
            >
              {duraklatildi ? (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Devam
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Duraklat
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="h-9 px-3 bg-vw-success hover:bg-vw-success/90 text-white"
              onClick={() => onClose(session)}
            >
              <Package className="w-4 h-4 mr-1" />
              Kapat
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
