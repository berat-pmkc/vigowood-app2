"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  startPreparation,
  shipSevkiyat,
  deliverSevkiyat,
  cancelSevkiyat,
} from "../../actions";
import type { SevkiyatRow } from "../../actions";
import type { SevkiyatStatus } from "@/lib/constants";
import {
  PackageCheck,
  Truck,
  CheckCircle,
  Undo2,
  FileText,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ShipmentActionsProps {
  sevkiyat: SevkiyatRow;
  hasItems: boolean;
  onStatusChanged: () => void;
}

export function ShipmentActions({
  sevkiyat,
  hasItems,
  onStatusChanged,
}: ShipmentActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const durum = sevkiyat.durum as SevkiyatStatus;

  const handleAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    actionName: string,
    successMsg: string
  ) => {
    setLoading(actionName);
    const result = await action();
    if (!result.success) {
      toast.error(result.error ?? "Bir hata oluştu");
    } else {
      toast.success(successMsg);
      onStatusChanged();
    }
    setLoading(null);
  };

  const handleDownloadPdf = (type: "proforma" | "packing-list") => {
    const url = `/api/sevkiyat/${sevkiyat.sevkiyat_id}/${type}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* PDF Butonları */}
      {hasItems && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => handleDownloadPdf("proforma")}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Proforma PDF</span>
            <span className="sm:hidden">Proforma</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => handleDownloadPdf("packing-list")}
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Paket Listesi PDF</span>
            <span className="sm:hidden">Paket L.</span>
          </Button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Durum Butonları */}
      <div className="flex gap-2">
        {durum === "bekliyor" && (
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            disabled={loading === "start" || !hasItems}
            onClick={() =>
              handleAction(
                () => startPreparation(sevkiyat.sevkiyat_id),
                "start",
                "Hazırlık başlatıldı"
              )
            }
          >
            {loading === "start" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PackageCheck className="w-4 h-4" />
            )}
            Hazırlamayı Başlat
          </Button>
        )}

        {durum === "hazirlaniyor" && (
          <>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={loading === "cancel"}
              onClick={() =>
                handleAction(
                  () => cancelSevkiyat(sevkiyat.sevkiyat_id),
                  "cancel",
                  "Geri alındı"
                )
              }
            >
              {loading === "cancel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Undo2 className="w-4 h-4" />
              )}
              Geri Al
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              disabled={loading === "ship"}
              onClick={() =>
                handleAction(
                  () => shipSevkiyat(sevkiyat.sevkiyat_id),
                  "ship",
                  "Sevkiyat gönderildi, stok düşüldü"
                )
              }
            >
              {loading === "ship" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              Gönder
            </Button>
          </>
        )}

        {durum === "yolda" && (
          <>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={loading === "cancel"}
              onClick={() =>
                handleAction(
                  () => cancelSevkiyat(sevkiyat.sevkiyat_id),
                  "cancel",
                  "Geri alındı, stok iade edildi"
                )
              }
            >
              {loading === "cancel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Undo2 className="w-4 h-4" />
              )}
              Geri Al
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={loading === "deliver"}
              onClick={() =>
                handleAction(
                  () => deliverSevkiyat(sevkiyat.sevkiyat_id),
                  "deliver",
                  "Teslim edildi"
                )
              }
            >
              {loading === "deliver" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Teslim Edildi
            </Button>
          </>
        )}

        {durum === "teslim_edildi" && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Teslim Edildi</span>
          </div>
        )}
      </div>
    </div>
  );
}
