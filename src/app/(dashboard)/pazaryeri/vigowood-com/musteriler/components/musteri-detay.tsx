"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  ShoppingCart,
  Calendar,
  MapPin,
  Check,
  X,
} from "lucide-react";
import type { IkasCustomerDB } from "@/lib/supabase/types";
import { CUSTOMER_SEGMENTS } from "@/lib/ikas/helpers";

interface Props {
  customer: IkasCustomerDB;
}

export function MusteriDetay({ customer }: Props) {
  const segment = CUSTOMER_SEGMENTS.find((s) => s.key === customer.customer_segment)
    || CUSTOMER_SEGMENTS.find((s) => s.key === "yeni")!;

  const segmentLabels: Record<string, string> = {
    vip: "VIP Müşteri",
    sadik: "Sadık Müşteri",
    aktif: "Aktif Müşteri",
    yeni: "Yeni Müşteri",
    kayip: "Kayıp Müşteri",
    potansiyel: "Potansiyel Müşteri",
  };

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTRY(amount: number | null): string {
    if (amount == null || amount === 0) return "-";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <div className="mt-4 space-y-5">
      {/* Customer Name */}
      <div>
        <p className="text-lg font-bold">
          {customer.first_name} {customer.last_name}
        </p>
      </div>

      <Separator />

      {/* Contact Info */}
      <div className="grid gap-3">
        {customer.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Email:</span>
            <span>{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Telefon:</span>
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.city && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Şehir:</span>
            <span>{customer.city}{customer.country && customer.country !== "TR" ? `, ${customer.country}` : ""}</span>
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
          <p className="mt-1 text-2xl font-bold">{customer.order_count ?? 0}</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <span className="text-xs">Toplam Harcama</span>
          </div>
          <p className="mt-1 text-2xl font-bold">
            {formatTRY(customer.total_spent)}
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="grid gap-3">
        {customer.first_order_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">İlk Sipariş:</span>
            <span>{formatDate(customer.first_order_date)}</span>
          </div>
        )}
        {customer.last_order_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Son Sipariş:</span>
            <span>{formatDate(customer.last_order_date)}</span>
          </div>
        )}
        {customer.ikas_synced_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs">Son sync: {formatDate(customer.ikas_synced_at)}</span>
          </div>
        )}
      </div>

      {/* Marketing consent + Customer value badge */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`${segment.bg} ${segment.text} ${segment.hoverBg}`}>
          {segmentLabels[segment.key] ?? segment.label}
        </Badge>
        {(customer as IkasCustomerDB & { accepts_marketing?: boolean | null }).accepts_marketing ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Check className="mr-1 h-3 w-3" />
            İletişim İzni Var
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <X className="mr-1 h-3 w-3" />
            İletişim İzni Yok
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{segment.description}</p>
    </div>
  );
}
