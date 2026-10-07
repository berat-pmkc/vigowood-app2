/** Ek seans ekranları için istemci-güvenli biçimlendiriciler */

export function saatTr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
}

export function tarihSaatTr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** dakika -> "sa:dk" (örn. 1:05) */
export function saDk(dk: number | null | undefined): string {
  if (dk === null || dk === undefined) return "—";
  const t = Math.max(0, Math.round(dk));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export const DURUM_ETIKET: Record<string, string> = {
  acik: "Açık",
  beklemede: "Beklemede",
  tamamlandi: "Tamamlandı",
};

export const DURUM_STIL: Record<string, string> = {
  acik: "bg-blue-100 text-blue-800",
  beklemede: "bg-amber-100 text-amber-800",
  tamamlandi: "bg-emerald-100 text-emerald-800",
};
