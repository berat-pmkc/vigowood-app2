"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  MapPin,
  Clock,
  User,
  CreditCard,
} from "lucide-react";
import type { IkasOrder } from "@/lib/ikas/types";
import {
  formatIkasDate,
  formatTRY,
  getDisplayStatus,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/ikas/helpers";

interface Props {
  order: IkasOrder;
}

export function SiparisDetay({ order }: Props) {
  const { label: statusLabel, bg: statusBg, text: statusText } = getDisplayStatus(order);
  const paymentColors = PAYMENT_STATUS_COLORS[order.orderPaymentStatus] || { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <div className="mt-4 space-y-5">
      {/* Status + Order Number */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sipariş No</p>
          <p className="font-mono text-lg font-bold">{order.orderNumber}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={`${statusBg} ${statusText} hover:${statusBg}`}>
            {statusLabel}
          </Badge>
          <Badge className={`${paymentColors.bg} ${paymentColors.text} hover:${paymentColors.bg}`}>
            {PAYMENT_STATUS_LABELS[order.orderPaymentStatus] || order.orderPaymentStatus}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Date & Channel */}
      <div className="grid gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Sipariş Tarihi:</span>
          <span>{formatIkasDate(order.orderedAt)}</span>
        </div>
        {order.salesChannel && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Kanal:</span>
            <span>{order.salesChannel.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Para Birimi:</span>
          <span>{order.currencyCode}</span>
        </div>
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
            {order.customer.firstName} {order.customer.lastName}
          </p>
          {order.customer.email && (
            <p>
              <span className="font-medium">Email:</span>{" "}
              {order.customer.email}
            </p>
          )}
          {order.customer.phone && (
            <p>
              <span className="font-medium">Telefon:</span>{" "}
              {order.customer.phone}
            </p>
          )}
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4" /> Teslimat Adresi
        </h3>
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p>{order.shippingAddress.addressLine1}</p>
          <p>
            {order.shippingAddress.city.name} / {order.shippingAddress.country.name}
          </p>
        </div>
      </div>

      <Separator />

      {/* Order Lines */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" /> Ürünler
        </h3>
        <div className="space-y-3">
          {order.orderLineItems.map((line) => (
            <div
              key={line.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{line.variant.name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>SKU: {line.variant.sku}</span>
                  <span>Adet: {line.quantity}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatTRY(line.finalPrice)}</p>
                {line.price !== line.finalPrice && (
                  <p className="text-xs text-muted-foreground line-through">
                    {formatTRY(line.price)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-2 rounded-md bg-muted/50 p-3">
        {order.totalPrice !== order.totalFinalPrice && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span className="line-through">{formatTRY(order.totalPrice)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Toplam</span>
          <span className="text-lg font-bold">{formatTRY(order.totalFinalPrice)}</span>
        </div>
      </div>
    </div>
  );
}
