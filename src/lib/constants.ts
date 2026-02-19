// VigoWood Platform Constants

export const APP_NAME = "VigoWood";
export const APP_DESCRIPTION = "Ahşap mobilya entegre iş yönetim platformu";

// Color palette — matches globals.css and CLAUDE.md
export const COLORS = {
  // Natural Color (Ana Tema)
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",

  // Functional Color
  success: "#70c1aa",
  warning: "#f28a19",
  error: "#ee7683",
  info: "#3368b1",

  // Recycle Color (Üretim durumları)
  recycle1: "#e3ecd2",
  recycle2: "#b1d286",
  recycle3: "#8d9d70",
  recycle4: "#3caa35",

  // Ekstra
  deepNavy: "#0c1c2d",
  hotWalnuts: "#6f4c37",
  iceBlue: "#adb5be",
  black: "#000000",
} as const;

// User roles
export const USER_ROLES = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Üretim",
  "Hat",
  "Muhasebe",
  "Sevkiyat Sorumlusu",
  "Pazaryeri Sorumlusu",
  "Mimar",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// Production flow stages
export const PRODUCTION_STAGES = [
  "Kesim",
  "Temizlik",
  "Montaj",
  "Paketleme",
  "Sevkiyat",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

// Shared station accounts
export const STATION_EMAILS = [
  "kesim@vigowood.com",
  "temizlik@vigowood.com",
  "montaj@vigowood.com",
  "montaj2@vigowood.com",
  "paketleme@vigowood.com",
  "kutu@vigowood.com",
] as const;
