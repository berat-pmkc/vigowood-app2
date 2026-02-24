/**
 * Trendyol API Helper Functions
 * Status mapping, date conversion, price calculations
 */
import type { TrendyolOrderStatus, TrendyolQuestionStatus, TrendyolOrder, TrendyolSettlement } from "./types";

// ─── Order Status Mapping ────────────────────────────────
export const ORDER_STATUS_LABELS: Record<TrendyolOrderStatus, string> = {
  Created: "Yeni Sipariş",
  Picking: "Hazırlanıyor",
  Invoiced: "Fatura Kesildi",
  Shipped: "Kargoda",
  Delivered: "Teslim Edildi",
  Cancelled: "İptal",
  UnSupplied: "Tedarik Edilemedi",
  Returned: "İade Edildi",
  UnDelivered: "Teslim Edilemedi",
  UnPacked: "Paket Ayrıldı",
  AtCollectionPoint: "Teslim Noktasında",
  Awaiting: "Ödeme Bekleniyor",
};

export const ORDER_STATUS_COLORS: Record<TrendyolOrderStatus, { bg: string; text: string }> = {
  Created: { bg: "bg-blue-100", text: "text-blue-800" },
  Picking: { bg: "bg-amber-100", text: "text-amber-800" },
  Invoiced: { bg: "bg-indigo-100", text: "text-indigo-800" },
  Shipped: { bg: "bg-purple-100", text: "text-purple-800" },
  Delivered: { bg: "bg-emerald-100", text: "text-emerald-800" },
  Cancelled: { bg: "bg-red-100", text: "text-red-800" },
  UnSupplied: { bg: "bg-orange-100", text: "text-orange-800" },
  Returned: { bg: "bg-rose-100", text: "text-rose-800" },
  UnDelivered: { bg: "bg-yellow-100", text: "text-yellow-800" },
  UnPacked: { bg: "bg-gray-100", text: "text-gray-800" },
  AtCollectionPoint: { bg: "bg-cyan-100", text: "text-cyan-800" },
  Awaiting: { bg: "bg-slate-100", text: "text-slate-800" },
};

// Tab filters for the orders page
export const ORDER_TAB_FILTERS: { label: string; status: TrendyolOrderStatus | "all" }[] = [
  { label: "Tümü", status: "all" },
  { label: "Yeni", status: "Created" },
  { label: "Hazırlanıyor", status: "Picking" },
  { label: "Kargoda", status: "Shipped" },
  { label: "Teslim Edildi", status: "Delivered" },
  { label: "İptal/İade", status: "Cancelled" },
];

// ─── Question Status Mapping ─────────────────────────────
export const QUESTION_STATUS_LABELS: Record<TrendyolQuestionStatus, string> = {
  WAITING_FOR_ANSWER: "Cevap Bekliyor",
  WAITING_FOR_APPROVE: "Onay Bekliyor",
  ANSWERED: "Cevaplandı",
  REPORTED: "Raporlandı",
  REJECTED: "Reddedildi",
};

export const QUESTION_STATUS_COLORS: Record<TrendyolQuestionStatus, { bg: string; text: string }> = {
  WAITING_FOR_ANSWER: { bg: "bg-amber-100", text: "text-amber-800" },
  WAITING_FOR_APPROVE: { bg: "bg-blue-100", text: "text-blue-800" },
  ANSWERED: { bg: "bg-emerald-100", text: "text-emerald-800" },
  REPORTED: { bg: "bg-orange-100", text: "text-orange-800" },
  REJECTED: { bg: "bg-red-100", text: "text-red-800" },
};

// ─── Date Helpers ────────────────────────────────────────
/** Trendyol timestamp (ms, GMT+3) → JS Date */
export function trendyolTimestampToDate(ts: number): Date {
  return new Date(ts);
}

/** JS Date → Trendyol timestamp (ms) */
export function dateToTrendyolTimestamp(date: Date): number {
  return date.getTime();
}

/** Format timestamp to DD.MM.YYYY HH:mm */
export function formatTrendyolDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/** Format timestamp to DD.MM.YYYY */
export function formatTrendyolDateShort(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Get start of day N days ago as timestamp */
export function daysAgoTimestamp(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Get end of today as timestamp */
export function endOfTodayTimestamp(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// ─── Price / Finance Helpers ─────────────────────────────
/** Format price with ₺ symbol */
export function formatTRY(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Calculate order total from lines */
export function calculateOrderTotal(order: TrendyolOrder): number {
  return order.lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Calculate total commission from lines */
export function calculateOrderCommission(order: TrendyolOrder): number {
  return order.lines.reduce((sum, line) => {
    const commission = line.commission ?? 0;
    return sum + (line.amount * commission) / 100;
  }, 0);
}

/** Aggregate settlements: total sales, commissions, net */
export function aggregateSettlements(settlements: TrendyolSettlement[]): {
  totalSales: number;
  totalReturns: number;
  totalCommission: number;
  totalDiscount: number;
  netAmount: number;
} {
  let totalSales = 0;
  let totalReturns = 0;
  let totalCommission = 0;
  let totalDiscount = 0;

  for (const s of settlements) {
    const credit = s.credit ?? 0;
    const debt = s.debt ?? 0;

    switch (s.transactionType) {
      case "Sale":
        totalSales += credit;
        break;
      case "Return":
        totalReturns += debt;
        break;
      case "CommissionNegative":
      case "CommissionPositive":
        totalCommission += debt - credit;
        break;
      case "Discount":
      case "TYDiscount":
        totalDiscount += debt;
        break;
    }
  }

  return {
    totalSales,
    totalReturns,
    totalCommission,
    totalDiscount,
    netAmount: totalSales - totalReturns - totalCommission - totalDiscount,
  };
}

/** Get order customer full name */
export function getCustomerName(order: TrendyolOrder): string {
  return `${order.customerFirstName} ${order.customerLastName}`.trim();
}

/** Get a summary of product names in order */
export function getOrderProductSummary(order: TrendyolOrder): string {
  if (order.lines.length === 0) return "-";
  if (order.lines.length === 1) return order.lines[0].productName;
  return `${order.lines[0].productName} +${order.lines.length - 1} ürün`;
}

/** Calculate total quantity in order */
export function getOrderTotalQuantity(order: TrendyolOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}
