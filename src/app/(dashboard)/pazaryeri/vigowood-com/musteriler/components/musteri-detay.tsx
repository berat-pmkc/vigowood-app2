"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  ShoppingCart,
  Calendar,
} from "lucide-react";
import type { IkasCustomer } from "@/lib/ikas/types";
import { formatTRY, formatIkasDateShort, getCustomerSegment } from "@/lib/ikas/helpers";

interface Props {
  customer: IkasCustomer;
}

export function MusteriDetay({ customer }: Props) {
  const segment = getCustomerSegment(customer.orderCount);

  return (
    <div className="mt-4 space-y-5">
      {/* Customer Name */}
      <div>
        <p className="text-lg font-bold">
          {customer.firstName} {customer.lastName}
        </p>
      </div>

      <Separator />

      {/* Contact Info */}
      <div className="grid gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Email:</span>
          <span>{customer.email}</span>
        </div>
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Telefon:</span>
            <span>{customer.phone}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs">Toplam Sipariş</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{customer.orderCount ?? 0}</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <span className="text-xs">Toplam Harcama</span>
          </div>
          <p className="mt-1 text-2xl font-bold">
            {customer.totalOrderPrice ? formatTRY(customer.totalOrderPrice) : "-"}
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="grid gap-3">
        {customer.firstOrderDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">İlk Sipariş:</span>
            <span>{formatIkasDateShort(customer.firstOrderDate)}</span>
          </div>
        )}
        {customer.lastOrderDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Son Sipariş:</span>
            <span>{formatIkasDateShort(customer.lastOrderDate)}</span>
          </div>
        )}
      </div>

      {/* Customer value badge */}
      <div>
        <Badge className={`${segment.bg} ${segment.text} hover:${segment.bg}`}>
          {segment.key === "vip" ? "VIP Müşteri" :
           segment.key === "sadik" ? "Sadık Müşteri" :
           segment.key === "aktif" ? "Aktif Müşteri" :
           "Yeni Kayıt"}
        </Badge>
      </div>
    </div>
  );
}
