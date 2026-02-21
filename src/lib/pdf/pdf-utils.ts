import path from "path";
import { Font } from "@react-pdf/renderer";
import { PROFORMA_CONFIG } from "@/lib/constants";

/**
 * Register Roboto font family (supports Turkish characters: ş, ğ, ı, İ, Ş, Ğ)
 * Call once before rendering any PDF that needs Turkish text.
 */
let _fontsRegistered = false;
export function registerTurkishFonts() {
  if (_fontsRegistered) return;
  _fontsRegistered = true;

  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });
}

/**
 * Format number for Turkish locale (dot thousand separator, comma decimal)
 */
export function formatTrNumber(value: number, decimals = 0): string {
  const parts = value.toFixed(decimals).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimals > 0 && parts[1]) {
    return intPart + "," + parts[1];
  }
  return intPart;
}

/**
 * Format currency for Turkish locale
 */
export function formatTrCurrency(value: number): string {
  return formatTrNumber(value, 2) + " TL";
}

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
