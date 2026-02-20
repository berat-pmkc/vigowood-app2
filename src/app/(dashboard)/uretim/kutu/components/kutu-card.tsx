"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KutuStatusBadge } from "./kutu-status-badge";
import { KutuDetailSheet } from "./kutu-detail-sheet";
import { startKutu } from "../actions";
import {
  KUTU_STATUS_BORDER_COLORS,
  PART_TYPE_LABELS,
  type KutuStatus,
  type PartType,
} from "@/lib/constants";
import { formatTime, formatDuration, cn } from "@/lib/utils";
import { Play, CheckCircle, User, Clock, Box } from "lucide-react";
import { toast } from "sonner";

export interface KutuSessionRow {
  session_id: string;
  email: string | null;
  tarih: string | null;
  part_id: string | null;
  part_adi: string | null;
  part_type: string | null;
  qty: number;
  not_text: string | null;
  durum: string;
  operator_id: string | null;
  operator_name: string | null;
  start_time: string | null;
  bitis_zamani: string | null;
  created_at: string;
}

interface KutuCardProps {
  session: KutuSessionRow;
}

export function KutuCard({ session }: KutuCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const durum = session.durum as KutuStatus;
  const borderColor = KUTU_STATUS_BORDER_COLORS[durum] ?? KUTU_STATUS_BORDER_COLORS.bekliyor;
  const isTamamlandi = durum === "tamamlandi";

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startKutu(session.session_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kutu üretimi başlatıldı");
    setLoading(false);
  };

  const partTypeLabel = session.part_type
    ? PART_TYPE_LABELS[session.part_type as PartType] ?? session.part_type
    : null;

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
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {session.session_id}
              </Badge>
              {partTypeLabel && (
                <Badge variant="outline" className="text-xs">
                  {partTypeLabel}
                </Badge>
              )}
            </div>
            <KutuStatusBadge durum={session.durum} />
          </div>

          {/* Body */}
          <div className="mb-3">
            <p className="font-medium text-foreground truncate">
              {session.part_adi ?? session.part_id ?? "—"}
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
              {durum === "tamamlandi" && session.start_time && session.bitis_zamani && (
                <span>{formatDuration(session.start_time, session.bitis_zamani)}</span>
              )}
              {durum === "uretimde" && session.start_time && (
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

            {durum === "uretimde" && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
              >
                <Box className="w-4 h-4 mr-1" />
                Detay
              </Button>
            )}

            {isTamamlandi && (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </Card>

      <KutuDetailSheet
        session={session}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
