import { PROFORMA_CONFIG } from "@/lib/constants";

/**
 * Format number with locale-specific separators
 */
export function formatPdfNumber(
  value: number,
  decimals: number,
  countryCode: string
): string {
  const fmt = PROFORMA_CONFIG.COUNTRY_FORMAT[countryCode] ?? {
    decimal: ",",
    thousand: ".",
  };
  const parts = value.toFixed(decimals).split(".");
  const intPart = parts[0].replace(
    /\B(?=(\d{3})+(?!\d))/g,
    fmt.thousand
  );
  if (decimals > 0 && parts[1]) {
    return intPart + fmt.decimal + parts[1];
  }
  return intPart;
}

/**
 * Format currency with symbol placement
 */
export function formatPdfCurrency(
  value: number,
  countryCode: string
): string {
  const fmt = PROFORMA_CONFIG.COUNTRY_FORMAT[countryCode];
  if (!fmt) return value.toFixed(2);
  const formatted = formatPdfNumber(value, 2, countryCode);
  return fmt.position === "before"
    ? `${fmt.currencySymbol}${formatted}`
    : `${formatted} ${fmt.currencySymbol}`;
}

/**
 * Format date as dd/MM/yyyy
 */
export function formatPdfDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as yyyy-MM-dd
 */
export function formatPdfDateISO(iso: string | null): string {
  if (!iso) {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

/**
 * Format date as ddMMyyyy for invoice number
 */
export function formatInvoiceDateStr(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}
