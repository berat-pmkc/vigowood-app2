import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format ISO date string to GG.AA.YYYY (Turkish display) */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format number with Turkish locale (1.234,56) */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR");
}

/** Format ISO timestamp to HH:MM */
export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/** Format duration between two ISO timestamps → "Xsa Ydk" */
export function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";
  const diffMs = e.getTime() - s.getTime();
  if (diffMs < 0) return "—";
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}sa ${mins}dk`;
  return `${mins}dk`;
}

/** Calculate elapsed time from start to now → "Xsa Ydk" */
export function formatElapsed(start: string | null): string {
  if (!start) return "—";
  const s = new Date(start);
  if (isNaN(s.getTime())) return "—";
  return formatDuration(start, new Date().toISOString());
}

/** Format currency with symbol: 1.234,56 ₺ or $1,234.56 */
export function formatCurrency(
  n: number | null | undefined,
  currency: "TL" | "USD" | "EUR" = "TL"
): string {
  if (n == null) return "—";
  if (currency === "USD") {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === "EUR") {
    return `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

/** Format compact currency: 1,2M ₺ or $1.2M */
export function formatCurrencyCompact(
  n: number | null | undefined,
  currency: "TL" | "USD" | "EUR" = "TL"
): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1) + "M";
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(1) + "K";
  } else {
    formatted = abs.toFixed(0);
  }
  if (currency === "USD") return `${sign}$${formatted}`;
  if (currency === "EUR") return `${sign}€${formatted}`;
  return `${sign}${formatted} ₺`;
}

const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Format "2026-2-D1" → "Şubat 2026 — 1. Dönem" */
export function formatDonemKodu(kod: string): string {
  const match = kod.match(/^(\d{4})-(\d{1,2})-D(\d)$/);
  if (!match) return kod;
  const [, yil, ay, donem] = match;
  const ayIdx = Number(ay) - 1;
  if (ayIdx < 0 || ayIdx > 11) return kod;
  return `${AY_ISIMLERI[ayIdx]} ${yil} — ${donem}. Dönem`;
}

/** Get 42 dates for a calendar grid (6 weeks × 7 days), starting Monday */
export function getDaysInMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  // getDay: 0=Sun...6=Sat. Convert to Mon=0...Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

/** Get week range (Monday–Sunday) for a given date */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Get month range for a given year/month (0-indexed) */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Dev-only: time a Promise and log to console */
export async function timedQuery<T>(label: string, query: Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== "development") return query;
  const start = performance.now();
  const result = await query;
  const ms = (performance.now() - start).toFixed(0);
  console.log(`[DB] ${label}: ${ms}ms`);
  return result;
}

/** Relative time: "5 dk önce", "2 saat önce", "3 gün önce" */
export function formatDistanceToNow(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} gün önce`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} ay önce`;
  return formatDate(iso);
}
