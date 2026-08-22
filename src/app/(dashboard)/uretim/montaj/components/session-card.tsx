"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, X, Users, AlertTriangle } from "lucide-react";
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

/**
 * Açık kalma süresine göre seansın durumu.
 *
 * Neden gerekli: seans kapatmayı unutmak sessiz bir hata. Kapanmayan seans
 * hem canlı listeyi kirletiyor hem de süre analizini bozuyor — veride gece
 * boyu açık kalmış (1385 dk) bir kayıt tek başına bir adımı "en pahalı adım"
 * göstermişti. Kart üzerinde görünür olması, uyarı e-postasını beklemeden
 * fark edilmesini sağlıyor.
 */
type Yaslanma = "normal" | "uzun" | "kritik";

function yaslanmaHesapla(startTime: string): { durum: Yaslanma; saat: number; bugunMu: boolean } {
  const bas = new Date(startTime);
  const saat = (Date.now() - bas.getTime()) / 3_600_000;
  const bugunMu = bas.toDateString() === new Date().toDateString();
  // Önceki güne ait her açık seans kritik: vardiya bitti, kapanmamış demek.
  if (!bugunMu || saat >= 8) return { durum: "kritik", saat, bugunMu };
  if (saat >= 4) return { durum: "uzun", saat, bugunMu };
  return { durum: "normal", saat, bugunMu };
}

const YASLANMA_STILI: Record<Yaslanma, { kenar: string; zemin: string; yazi: string; rozet: string }> = {
  normal:  { kenar: "", zemin: "", yazi: "text-blue-600", rozet: "" },
  uzun:    { kenar: "#f28a19", zemin: "bg-amber-50/60", yazi: "text-amber-700",
             rozet: "bg-amber-100 text-amber-800 border-amber-300" },
  kritik:  { kenar: "#ee7683", zemin: "bg-red-50/60", yazi: "text-red-700",
             rozet: "bg-red-100 text-red-800 border-red-300" },
};

function LiveTimer({ startTime, renk }: { startTime: string; renk: string }) {
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

  return <span className={cn("text-sm font-bold tabular-nums", renk)}>{elapsed}</span>;
}

export function SessionCard({ session, onClose, onCancel, canCancel }: SessionCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const skuStyle = getSkuBadgeStyle(session.sku);

  const yas = session.start_time ? yaslanmaHesapla(session.start_time) : null;
  const stil = YASLANMA_STILI[yas?.durum ?? "normal"];

  return (
    <Card
      className={cn("relative border-l-[3px]", stil.zemin)}
      style={{ borderLeftColor: stil.kenar || skuStyle.borderColor }}
    >
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
          {yas && yas.durum !== "normal" && (
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px] font-medium", stil.rozet)}
              title={
                yas.bugunMu
                  ? `${yas.saat.toFixed(1)} saattir açık`
                  : `${new Date(session.start_time!).toLocaleDateString("tr-TR")} tarihinden beri açık`
              }
            >
              <AlertTriangle className="mr-0.5 inline size-2.5" />
              {yas.bugunMu ? "Uzun süredir açık" : "Dünden kalma"}
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
            <Clock className={cn("w-3.5 h-3.5", stil.yazi)} />
            {session.start_time ? (
              <>
                <LiveTimer startTime={session.start_time} renk={stil.yazi} />
                {yas && !yas.bugunMu && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(session.start_time).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                  </span>
                )}
              </>
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
