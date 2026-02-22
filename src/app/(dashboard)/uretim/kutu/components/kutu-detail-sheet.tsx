"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { KutuStatusBadge } from "./kutu-status-badge";
import { completeKutu, cancelKutu } from "../actions";
import { PART_TYPE_LABELS, type KutuStatus, type PartType } from "@/lib/constants";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  User,
  Box,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { KutuSessionEnriched } from "../page";

interface KutuDetailSheetProps {
  session: KutuSessionEnriched;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KutuDetailSheet({ session, open, onOpenChange }: KutuDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const durum = session.durum as KutuStatus;

  const handleComplete = async () => {
    setActionLoading(true);
    const result = await completeKutu(session.session_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Kutu üretimi tamamlandı, parça stok güncellendi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelKutu(session.session_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Kutu üretimi iptal edildi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const partTypeLabel = session.part_type
    ? PART_TYPE_LABELS[session.part_type as PartType] ?? session.part_type
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{session.session_id}</Badge>
            <KutuStatusBadge durum={session.durum} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Parça</p>
              <p className="font-medium">{session.part_adi ?? session.part_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Adet</p>
              <p className="font-semibold text-lg">{session.qty}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ürün (SKU)</p>
              <p className="font-medium">{session.urun_adi ?? session.sku ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Şablon</p>
              <p className="font-medium">{session.plaka_adi ?? session.plaka_id ?? "—"}</p>
            </div>
            {partTypeLabel && (
              <div>
                <p className="text-muted-foreground">Tip</p>
                <Badge variant="outline" className="text-xs">{partTypeLabel}</Badge>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Operatör</p>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground" />
                <p className="font-medium">{session.operator_name ?? "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Tarih</p>
              <p className="font-medium">{formatDate(session.tarih)}</p>
            </div>
            {session.start_time && (
              <div>
                <p className="text-muted-foreground">Başlama</p>
                <p className="font-medium">{formatTime(session.start_time)}</p>
              </div>
            )}
            {session.bitis_zamani && (
              <div>
                <p className="text-muted-foreground">Süre</p>
                <p className="font-medium">{formatDuration(session.start_time, session.bitis_zamani)}</p>
              </div>
            )}
          </div>

          {session.not_text && (
            <div className="text-sm">
              <p className="text-muted-foreground">Not</p>
              <p className="font-medium">{session.not_text}</p>
            </div>
          )}

          <Separator />

          {durum === "tamamlandi" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-700 text-sm">Parça Stok Girişi</span>
              </div>
              <p className="text-sm text-emerald-600">
                <span className="font-bold">{session.qty}</span> adet{" "}
                <span className="font-medium">{session.part_adi ?? session.part_id}</span>{" "}
                parça stoğa eklendi.
              </p>
            </div>
          )}

          {durum === "uretimde" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-700 text-sm">Üretim Devam Ediyor</span>
              </div>
              <p className="text-sm text-amber-600">
                Tamamlandığında <span className="font-bold">{session.qty}</span> adet parça stoğa eklenecek.
              </p>
            </div>
          )}

          <Separator />

          <div className="flex gap-2 pb-4">
            {durum === "uretimde" && (
              <>
                <Button
                  className="flex-1 h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Tamamla
                </Button>
                <Button
                  variant="outline"
                  className="h-14 px-4"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </>
            )}

            {durum === "tamamlandi" && (
              <div className="flex items-center gap-2 text-emerald-600 w-full justify-center py-2">
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">Üretim Tamamlandı</span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
