"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KutuStatusBadge } from "./kutu-status-badge";
import { KutuDetailSheet } from "./kutu-detail-sheet";
import { LiveTimer } from "@/components/shared/live-timer";
import { completeKutu, cancelKutu } from "../actions";
import { cn } from "@/lib/utils";
import { CheckCircle, User, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { KutuSessionEnriched } from "../page";

interface ActiveKutuCardProps {
  session: KutuSessionEnriched;
}

export function ActiveKutuCard({ session }: ActiveKutuCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await completeKutu(session.session_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kutu üretimi tamamlandı, stok güncellendi");
    setLoading(false);
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await cancelKutu(session.session_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kutu üretimi iptal edildi");
    setLoading(false);
  };

  return (
    <>
      <Card
        className={cn(
          "border-l-4 border-l-amber-500 cursor-pointer transition-all hover:shadow-md",
          "bg-amber-50/30"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-4">
          {/* Header — ID + Status */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {session.session_id}
              </Badge>
            </div>
            <KutuStatusBadge durum={session.durum} />
          </div>

          {/* Parça + Ürün */}
          <div className="mb-2">
            <p className="font-medium text-foreground truncate text-sm">
              {session.part_adi ?? session.part_id ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {session.urun_adi ?? session.sku ?? "—"}
              {session.plaka_adi && ` · ${session.plaka_adi}`}
            </p>
          </div>

          {/* Adet + Timer */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {session.qty}
              </span>
              <span className="text-sm text-muted-foreground">adet</span>
            </div>

            {session.start_time && (
              <div className="flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-amber-600" />
                <LiveTimer startTime={session.start_time} className="text-lg font-bold tabular-nums text-amber-700" />
              </div>
            )}
          </div>

          {/* Operatör */}
          {session.operator_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <User className="w-3 h-3" />
              <span>{session.operator_name}</span>
            </div>
          )}

          {/* Bitir butonu */}
          <div className="flex gap-2">
            <Button
              className="flex-1 h-12 text-base"
              onClick={handleComplete}
              disabled={loading}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Bitir
            </Button>
            <Button
              variant="outline"
              className="h-12 px-3"
              onClick={handleCancel}
              disabled={loading}
            >
              <XCircle className="w-5 h-5" />
            </Button>
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
