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
