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
import { PaketlemeStatusBadge } from "./paketleme-status-badge";
import { startPack, completePack, cancelPack } from "../actions";
import type { PackStatus } from "@/lib/constants";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Package,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { PackSessionRow } from "./paketleme-card";

interface PaketlemeDetailSheetProps {
  session: PackSessionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaketlemeDetailSheet({ session, open, onOpenChange }: PaketlemeDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const durum = session.durum as PackStatus;

  const handleStart = async () => {
    setActionLoading(true);
    const result = await startPack(session.session_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Paketleme başlatıldı"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const result = await completePack(session.session_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Paketleme tamamlandı, mamül stok güncellendi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelPack(session.session_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Paketleme iptal edildi"); onOpenChange(false); }
    setActionLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{session.session_id}</Badge>
            <PaketlemeStatusBadge durum={session.durum} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Seans bilgileri */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Ürün</p>
              <p className="font-medium">{session.urun_adi ?? session.sku ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Adet</p>
              <p className="font-semibold text-lg">{session.qty}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Operatör</p>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground" />
                <p className="font-medium">{session.operator_name ?? session.personel ?? "—"}</p>
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
            {session.end_time && (
              <div>
                <p className="text-muted-foreground">Süre</p>
                <p className="font-medium">{formatDuration(session.start_time, session.end_time)}</p>
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

          {/* Stok hareketi bilgisi */}
          {durum === "tamamlandi" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-700 text-sm">Mamül Stok Girişi</span>
              </div>
              <p className="text-sm text-emerald-600">
                <span className="font-bold">{session.qty}</span> adet{" "}
                <span className="font-medium">{session.urun_adi ?? session.sku}</span>{" "}
                mamül stoğa eklendi.
              </p>
            </div>
          )}

          {durum === "paketlemede" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-700 text-sm">Paketleme Devam Ediyor</span>
              </div>
              <p className="text-sm text-blue-600">
                Tamamlandığında <span className="font-bold">{session.qty}</span> adet mamül stoğa eklenecek.
              </p>
            </div>
          )}

          <Separator />

          {/* Aksiyon butonları */}
          <div className="flex gap-2 pb-4">
            {durum === "bekliyor" && (
              <Button
                className="flex-1 h-14 text-base bg-vw-success hover:bg-vw-success/90 text-white"
                onClick={handleStart}
                disabled={actionLoading}
              >
                <Play className="w-5 h-5 mr-2" />
                Paketlemeyi Başlat
              </Button>
            )}

            {durum === "paketlemede" && (
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
                <span className="font-medium">Paketleme Tamamlandı</span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
