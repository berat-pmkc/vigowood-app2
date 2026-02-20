"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaketlemeStatusBadge } from "./paketleme-status-badge";
import { PaketlemeDetailSheet } from "./paketleme-detail-sheet";
import { startPack } from "../actions";
import {
  PACK_STATUS_BORDER_COLORS,
  type PackStatus,
} from "@/lib/constants";
import { formatTime, formatDuration, cn } from "@/lib/utils";
import { Play, CheckCircle, User, Clock, Package } from "lucide-react";
import { toast } from "sonner";

export interface PackSessionRow {
  session_id: string;
  email: string | null;
  tarih: string | null;
  sku: string | null;
  personel: string | null;
  start_time: string | null;
  end_time: string | null;
  qty: number;
  not_text: string | null;
  status: string;
  durum: string;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
  // Enriched
  urun_adi?: string;
}

interface PaketlemeCardProps {
  session: PackSessionRow;
}

export function PaketlemeCard({ session }: PaketlemeCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const durum = session.durum as PackStatus;
  const borderColor = PACK_STATUS_BORDER_COLORS[durum] ?? PACK_STATUS_BORDER_COLORS.bekliyor;
  const isTamamlandi = durum === "tamamlandi";

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startPack(session.session_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Paketleme başlatıldı");
    setLoading(false);
  };

  return (
    <>
      <Card
        className={cn(
          "border-l-4 cursor-pointer transition-all hover:shadow-md",
          borderColor,
          isTamamlandi && "opacity-70"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <Badge variant="secondary" className="font-mono text-xs">
              {session.session_id}
            </Badge>
            <PaketlemeStatusBadge durum={session.durum} />
          </div>

          {/* Body */}
          <div className="mb-3">
            <p className="font-medium text-foreground truncate">
              {session.urun_adi ?? session.sku ?? "—"}
            </p>
            {session.not_text && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{session.not_text}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {session.qty}
              </span>
              <span className="text-sm text-muted-foreground">adet</span>
            </div>

            {session.operator_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{session.operator_name}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {durum === "tamamlandi" && session.start_time && session.end_time && (
                <span>{formatDuration(session.start_time, session.end_time)}</span>
              )}
              {durum === "paketlemede" && session.start_time && (
                <span>{formatTime(session.start_time)}&apos;den beri</span>
              )}
              {durum === "bekliyor" && (
                <span>{formatTime(session.created_at)}</span>
              )}
            </div>

            {durum === "bekliyor" && (
              <Button
                size="sm"
                className="h-10 px-4 bg-vw-success hover:bg-vw-success/90 text-white"
                onClick={handleStart}
                disabled={loading}
              >
                <Play className="w-4 h-4 mr-1" />
                Başlat
              </Button>
            )}

            {durum === "paketlemede" && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
              >
                <Package className="w-4 h-4 mr-1" />
                Detay
              </Button>
            )}

            {isTamamlandi && (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </Card>

      <PaketlemeDetailSheet
        session={session}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
