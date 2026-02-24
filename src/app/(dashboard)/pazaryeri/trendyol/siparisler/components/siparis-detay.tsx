"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package,
  MapPin,
  Truck,
  Clock,
  User,
} from "lucide-react";
import type { TrendyolOrder, TrendyolOrderStatus } from "@/lib/trendyol/types";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  formatTrendyolDate,
  formatTRY,
} from "@/lib/trendyol/helpers";
import { updateOrderStatus } from "../actions";

interface Props {
  order: TrendyolOrder;
}

export function SiparisDetay({ order }: Props) {
  const [loading, setLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const statusColors = ORDER_STATUS_COLORS[order.status as TrendyolOrderStatus] || { bg: "bg-gray-100", text: "text-gray-800" };

  const canPick = order.status === "Created";
  const canInvoice = order.status === "Picking";

  async function handleStatusUpdate(newStatus: "Picking" | "Invoiced") {
    if (newStatus === "Invoiced" && !invoiceNumber.trim()) {
      toast.error("Fatura numarası giriniz");
      return;
    }

    setLoading(true);
    const line = order.lines[0];
    if (!line) {
      toast.error("Sipariş satırı bulunamadı");
      setLoading(false);
      return;
    }

    const result = await updateOrderStatus(
      order.shipmentPackageId,
      line.id,
      line.quantity,
      newStatus,
      invoiceNumber || undefined
    );

    setLoading(false);

    if (result.success) {
      toast.success(
        newStatus === "Picking"
          ? "Sipariş hazırlanmaya başlandı"
          : "Fatura kesildi, kargoya verilecek"
      );
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="mt-4 space-y-5">
      {/* Status + Order Number */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sipariş No</p>
          <p className="font-mono text-lg font-bold">{order.orderNumber}</p>
        </div>
        <Badge className={`${statusColors.bg} ${statusColors.text} hover:${statusColors.bg}`}>
          {ORDER_STATUS_LABELS[order.status as TrendyolOrderStatus] || order.status}
        </Badge>
      </div>

      <Separator />

      {/* Date & Cargo */}
      <div className="grid gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Sipariş Tarihi:</span>
          <span>{formatTrendyolDate(order.orderDate)}</span>
        </div>
        {order.cargoProviderName && (
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Kargo:</span>
            <span>{order.cargoProviderName}</span>
            {order.cargoTrackingNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                ({order.cargoTrackingNumber})
              </span>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Customer Info */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4" /> Müşteri Bilgileri
        </h3>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Ad Soyad:</span>{" "}
            {order.customerFirstName} {order.customerLastName}
          </p>
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4" /> Teslimat Adresi
        </h3>
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">
            {order.shipmentAddress.firstName} {order.shipmentAddress.lastName}
          </p>
          <p>{order.shipmentAddress.fullAddress}</p>
          <p>
            {order.shipmentAddress.district} / {order.shipmentAddress.city}
          </p>
          {order.shipmentAddress.phone && (
            <p className="mt-1 text-muted-foreground">{order.shipmentAddress.phone}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Order Lines */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" /> Ürünler
        </h3>
        <div className="space-y-3">
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{line.productName}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>SKU: {line.merchantSku}</span>
                  <span>Barkod: {line.barcode}</span>
                  <span>Adet: {line.quantity}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatTRY(line.amount)}</p>
                {line.commission && (
                  <p className="text-xs text-muted-foreground">%{line.commission} komisyon</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
        <span className="font-semibold">Toplam</span>
        <span className="text-lg font-bold">{formatTRY(order.totalPrice)}</span>
      </div>

      {/* Package History */}
      {order.packageHistories && order.packageHistories.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Sipariş Geçmişi</h3>
            <div className="space-y-2">
              {order.packageHistories.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">
                    {formatTrendyolDate(h.createdDate)}
                  </span>
                  <span className="font-medium">
                    {ORDER_STATUS_LABELS[h.status as TrendyolOrderStatus] || h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      {(canPick || canInvoice) && (
        <>
          <Separator />
          <div className="space-y-3">
            {canPick && (
              <Button
                className="w-full"
                onClick={() => handleStatusUpdate("Picking")}
                disabled={loading}
              >
                {loading ? "İşleniyor..." : "Hazırlamaya Başla"}
              </Button>
            )}
            {canInvoice && (
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Fatura Numarası</Label>
                <Input
                  id="invoiceNumber"
                  placeholder="EME2026000012345"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={() => handleStatusUpdate("Invoiced")}
                  disabled={loading || !invoiceNumber.trim()}
                >
                  {loading ? "İşleniyor..." : "Fatura Kes & Kargoya Ver"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
