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
import { SevkiyatStatusBadge } from "./sevkiyat-status-badge";
import { SevkiyatItemsPanel } from "./sevkiyat-items-panel";
import {
  startPreparation,
  shipSevkiyat,
  deliverSevkiyat,
  cancelSevkiyat,
} from "../actions";
import type { SevkiyatStatus } from "@/lib/constants";
import type { KonteynerTipi } from "@/lib/shipment-settings-types";
import { getKonteynerLabel } from "@/lib/shipment-settings-types";
import { formatDate } from "@/lib/utils";
import {
  PackageCheck,
  Truck,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Container,
  TrendingDown,
  Anchor,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { SevkiyatRow } from "./sevkiyat-card";

interface SevkiyatDetailSheetProps {
  sevkiyat: SevkiyatRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  konteynerTipleri: KonteynerTipi[];
}

export function SevkiyatDetailSheet({ sevkiyat, open, onOpenChange, konteynerTipleri }: SevkiyatDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const durum = sevkiyat.durum as SevkiyatStatus;
  const isReadonly = durum === "yolda" || durum === "teslim_edildi";

  const handleStartPrep = async () => {
    setActionLoading(true);
    const result = await startPreparation(sevkiyat.sevkiyat_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Haz\u0131rl\u0131k ba\u015flat\u0131ld\u0131"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleShip = async () => {
    setActionLoading(true);
    const result = await shipSevkiyat(sevkiyat.sevkiyat_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Sevkiyat g\u00f6nderildi, stok g\u00fcncellendi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleDeliver = async () => {
    setActionLoading(true);
    const result = await deliverSevkiyat(sevkiyat.sevkiyat_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Sevkiyat teslim edildi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelSevkiyat(sevkiyat.sevkiyat_id);
    if (!result.success) toast.error(result.error);
    else {
      const msg = durum === "yolda"
        ? "Sevkiyat geri al\u0131nd\u0131, stok iade edildi"
        : "Sevkiyat bir ad\u0131m geri al\u0131nd\u0131";
      toast.success(msg);
      onOpenChange(false);
    }
    setActionLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{sevkiyat.sevkiyat_id}</Badge>
            {sevkiyat.country_code && (
              <Badge variant="outline" className="font-semibold">{sevkiyat.country_code}</Badge>
            )}
            <SevkiyatStatusBadge durum={sevkiyat.durum} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Sevkiyat ad\u0131 */}
          {sevkiyat.sevkiyat_adi && (
            <p className="text-lg font-semibold">{sevkiyat.sevkiyat_adi}</p>
          )}

          {/* Sevkiyat bilgileri */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">M\u00fc\u015fteri</p>
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <p className="font-medium truncate">{sevkiyat.musteri}</p>
              </div>
            </div>
            {sevkiyat.ulke && (
              <div>
                <p className="text-muted-foreground">\u00dclke</p>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <p className="font-medium">{sevkiyat.ulke}</p>
                </div>
              </div>
            )}
            {sevkiyat.liman && (
              <div>
                <p className="text-muted-foreground">Liman</p>
                <div className="flex items-center gap-1">
                  <Anchor className="w-3 h-3 text-muted-foreground" />
                  <p className="font-medium">{sevkiyat.liman}</p>
                </div>
              </div>
            )}
            {sevkiyat.konteyner_no && (
              <div>
                <p className="text-muted-foreground">Konteyner No</p>
                <div className="flex items-center gap-1">
                  <Container className="w-3 h-3 text-muted-foreground" />
                  <p className="font-medium">{sevkiyat.konteyner_no}</p>
                </div>
              </div>
            )}
            {sevkiyat.konteyner_tipi && (
              <div>
                <p className="text-muted-foreground">Konteyner Tipi</p>
                <p className="font-medium">
                  {getKonteynerLabel(sevkiyat.konteyner_tipi, konteynerTipleri)}
                </p>
              </div>
            )}
            {sevkiyat.teslimat_tipi && (
              <div>
                <p className="text-muted-foreground">Teslimat Tipi</p>
                <p className="font-medium">{sevkiyat.teslimat_tipi}</p>
              </div>
            )}
            {sevkiyat.sevk_tarihi && (
              <div>
                <p className="text-muted-foreground">Sevk Tarihi</p>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <p className="font-medium">{formatDate(sevkiyat.sevk_tarihi)}</p>
                </div>
              </div>
            )}
            {sevkiyat.operator_name && (
              <div>
                <p className="text-muted-foreground">Operat\u00f6r</p>
                <p className="font-medium">{sevkiyat.operator_name}</p>
              </div>
            )}
            {sevkiyat.hazirlama_zamani && (
              <div>
                <p className="text-muted-foreground">Haz\u0131rlama</p>
                <p className="font-medium">{formatDate(sevkiyat.hazirlama_zamani)}</p>
              </div>
            )}
            {sevkiyat.gonderim_zamani && (
              <div>
                <p className="text-muted-foreground">G\u00f6nderim</p>
                <p className="font-medium">{formatDate(sevkiyat.gonderim_zamani)}</p>
              </div>
            )}
            {sevkiyat.teslim_zamani && (
              <div>
                <p className="text-muted-foreground">Teslim</p>
                <p className="font-medium">{formatDate(sevkiyat.teslim_zamani)}</p>
              </div>
            )}
          </div>

          {sevkiyat.not_text && (
            <div className="text-sm">
              <p className="text-muted-foreground">Not</p>
              <p className="font-medium">{sevkiyat.not_text}</p>
            </div>
          )}

          <Separator />

          {/* \u00dcr\u00fcnler */}
          <SevkiyatItemsPanel
            sevkiyatId={sevkiyat.sevkiyat_id}
            countryCode={sevkiyat.country_code}
            readonly={isReadonly}
          />

          <Separator />

          {/* Stok bilgisi */}
          {durum === "yolda" && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-700 text-sm">Sevkiyat Yolda</span>
              </div>
              <p className="text-sm text-purple-600">
                \u00dcr\u00fcnler mam\u00fcl stoktan d\u00fc\u015f\u00fcld\u00fc. Teslimat bekleniyor.
              </p>
            </div>
          )}

          {durum === "teslim_edildi" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-700 text-sm">Teslim Edildi</span>
              </div>
              <p className="text-sm text-emerald-600">Sevkiyat ba\u015far\u0131yla teslim edildi.</p>
            </div>
          )}

          {durum === "hazirlaniyor" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-700 text-sm">Stok Bilgisi</span>
              </div>
              <p className="text-sm text-blue-600">
                G\u00f6nderildi\u011finde \u00fcr\u00fcnler mam\u00fcl stoktan d\u00fc\u015f\u00fclecek.
              </p>
            </div>
          )}

          <Separator />

          {/* Aksiyon butonlar\u0131 */}
          <div className="flex gap-2 pb-4">
            {durum === "bekliyor" && (
              <Button
                className="flex-1 h-14 text-base bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleStartPrep}
                disabled={actionLoading}
              >
                <PackageCheck className="w-5 h-5 mr-2" />
                Haz\u0131rlamay\u0131 Ba\u015flat
              </Button>
            )}

            {durum === "hazirlaniyor" && (
              <>
                <Button
                  className="flex-1 h-14 text-base bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleShip}
                  disabled={actionLoading}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  G\u00f6nder
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

            {durum === "yolda" && (
              <>
                <Button
                  className="flex-1 h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleDeliver}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Teslim Edildi
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

            {durum === "teslim_edildi" && (
              <div className="flex items-center gap-2 text-emerald-600 w-full justify-center py-2">
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">Teslim Edildi</span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
