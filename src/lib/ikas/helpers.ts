/**
 * İkas API Helper Functions
 * Status mapping, date conversion, price calculations
 */
import type {
  IkasOrderStatus,
  IkasPackageStatus,
  IkasPaymentStatus,
  IkasOrder,
} from "./types";

// ─── Order Status Mapping ────────────────────────────────
export const ORDER_STATUS_LABELS: Record<IkasOrderStatus, string> = {
  CREATED: "Yeni Sipariş",
  DRAFT: "Taslak",
  CANCELLED: "İptal",
  PARTIALLY_CANCELLED: "Kısmi İptal",
  REFUNDED: "İade Edildi",
  PARTIALLY_REFUNDED: "Kısmi İade",
  REFUND_REQUESTED: "İade Talebi",
  REFUND_REJECTED: "İade Reddedildi",
};

export const ORDER_STATUS_COLORS: Record<IkasOrderStatus, { bg: string; text: string }> = {
  CREATED: { bg: "bg-blue-100", text: "text-blue-800" },
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800" },
  PARTIALLY_CANCELLED: { bg: "bg-orange-100", text: "text-orange-800" },
  REFUNDED: { bg: "bg-rose-100", text: "text-rose-800" },
  PARTIALLY_REFUNDED: { bg: "bg-pink-100", text: "text-pink-800" },
  REFUND_REQUESTED: { bg: "bg-amber-100", text: "text-amber-800" },
  REFUND_REJECTED: { bg: "bg-slate-100", text: "text-slate-800" },
};

// ─── Package Status Mapping ─────────────────────────────
export const PACKAGE_STATUS_LABELS: Record<IkasPackageStatus, string> = {
  UNFULFILLED: "Yeni",
  FULFILLED: "Hazırlandı",
  PARTIALLY_FULFILLED: "Kısmen Hazırlandı",
  READY_FOR_SHIPMENT: "Kargoya Hazır",
  PARTIALLY_READY_FOR_SHIPMENT: "Kısmen Kargoya Hazır",
  DELIVERED: "Teslim Edildi",
  PARTIALLY_DELIVERED: "Kısmen Teslim",
  CANCELLED: "İptal",
  PARTIALLY_CANCELLED: "Kısmi İptal",
  REFUNDED: "İade Edildi",
  PARTIALLY_REFUNDED: "Kısmi İade",
  REFUND_REQUESTED: "İade Talebi",
  REFUND_REJECTED: "İade Reddedildi",
  UNABLE_TO_DELIVER: "Teslim Edilemedi",
  REFUND_REQUEST_ACCEPTED: "İade Onaylandı",
  CANCEL_REQUESTED: "İptal Talebi",
  CANCEL_REJECTED: "İptal Reddedildi",
};

export const PACKAGE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  UNFULFILLED: { bg: "bg-blue-100", text: "text-blue-800" },
  FULFILLED: { bg: "bg-indigo-100", text: "text-indigo-800" },
  PARTIALLY_FULFILLED: { bg: "bg-indigo-50", text: "text-indigo-700" },
  READY_FOR_SHIPMENT: { bg: "bg-purple-100", text: "text-purple-800" },
  PARTIALLY_READY_FOR_SHIPMENT: { bg: "bg-purple-50", text: "text-purple-700" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-800" },
  PARTIALLY_DELIVERED: { bg: "bg-emerald-50", text: "text-emerald-700" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800" },
  PARTIALLY_CANCELLED: { bg: "bg-red-50", text: "text-red-700" },
  REFUNDED: { bg: "bg-rose-100", text: "text-rose-800" },
  PARTIALLY_REFUNDED: { bg: "bg-rose-50", text: "text-rose-700" },
  REFUND_REQUESTED: { bg: "bg-amber-100", text: "text-amber-800" },
  REFUND_REJECTED: { bg: "bg-slate-100", text: "text-slate-800" },
  UNABLE_TO_DELIVER: { bg: "bg-yellow-100", text: "text-yellow-800" },
  REFUND_REQUEST_ACCEPTED: { bg: "bg-amber-50", text: "text-amber-700" },
  CANCEL_REQUESTED: { bg: "bg-orange-100", text: "text-orange-800" },
  CANCEL_REJECTED: { bg: "bg-gray-100", text: "text-gray-800" },
};

// ─── Payment Status Mapping ─────────────────────────────
export const PAYMENT_STATUS_LABELS: Record<IkasPaymentStatus, string> = {
  PAID: "Ödendi",
  PARTIALLY_PAID: "Kısmi Ödeme",
  WAITING: "Bekliyor",
  FAILED: "Başarısız",
};

export const PAYMENT_STATUS_COLORS: Record<IkasPaymentStatus, { bg: string; text: string }> = {
  PAID: { bg: "bg-emerald-100", text: "text-emerald-800" },
  PARTIALLY_PAID: { bg: "bg-amber-100", text: "text-amber-800" },
  WAITING: { bg: "bg-blue-100", text: "text-blue-800" },
  FAILED: { bg: "bg-red-100", text: "text-red-800" },
};

// ─── Tab Filters ────────────────────────────────────────
export const ORDER_TAB_FILTERS: { label: string; packageStatus: IkasPackageStatus | "all" | "cancelled" }[] = [
  { label: "Tümü", packageStatus: "all" },
  { label: "Yeni", packageStatus: "UNFULFILLED" },
  { label: "Hazırlanıyor", packageStatus: "FULFILLED" },
  { label: "Kargoda", packageStatus: "READY_FOR_SHIPMENT" },
  { label: "Teslim Edildi", packageStatus: "DELIVERED" },
  { label: "İptal/İade", packageStatus: "cancelled" },
];

// ─── Date Helpers ───────────────────────────────────────
/** İkas timestamp (ms) → DD.MM.YYYY HH:mm */
export function formatIkasDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/** İkas timestamp (ms) → DD.MM.YYYY */
export function formatIkasDateShort(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Start of day N days ago as ISO string */
export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** End of today as ISO string */
export function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Start of today as ISO string */
export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Price Helpers ──────────────────────────────────────
/** Format price with ₺ symbol */
export function formatTRY(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Order Helpers ──────────────────────────────────────
/** Get customer full name from order */
export function getCustomerName(order: IkasOrder): string {
  return `${order.customer.firstName} ${order.customer.lastName}`.trim();
}

/** Get product summary from order line items */
export function getOrderProductSummary(order: IkasOrder): string {
  if (order.orderLineItems.length === 0) return "-";
  const first = order.orderLineItems[0].variant.name;
  if (order.orderLineItems.length === 1) return first;
  return `${first} +${order.orderLineItems.length - 1} ürün`;
}

/** Calculate total quantity */
export function getOrderTotalQuantity(order: IkasOrder): number {
  return order.orderLineItems.reduce((sum, item) => sum + item.quantity, 0);
}

/** Get display status — prefer package status for shipping context */
export function getDisplayStatus(order: IkasOrder): { label: string; bg: string; text: string } {
  const pkgStatus = order.orderPackageStatus;
  const label = PACKAGE_STATUS_LABELS[pkgStatus] || pkgStatus;
  const colors = PACKAGE_STATUS_COLORS[pkgStatus] || { bg: "bg-gray-100", text: "text-gray-800" };
  return { label, ...colors };
}

/** Get primary variant price (TRY) */
export function getProductPrice(product: { variants: { prices: { sellPrice: number; currency: string | null }[] }[] }): number {
  if (!product.variants.length) return 0;
  const variant = product.variants[0];
  // Prefer TRY price
  const tryPrice = variant.prices.find((p) => p.currency === "TRY");
  if (tryPrice) return tryPrice.sellPrice;
  // Fallback to first price
  return variant.prices[0]?.sellPrice ?? 0;
}

/** Get primary variant SKU */
export function getProductSku(product: { variants: { sku: string }[] }): string {
  return product.variants[0]?.sku ?? "-";
}
