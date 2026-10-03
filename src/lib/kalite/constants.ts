/** Kalite (uygunsuz / fire) modülü sabitleri — istemci ve sunucuda kullanılabilir */

export type KaliteItemTipi = "URUN" | "YARI_MAMUL" | "PLAKA";
export type KaliteKaynak = "iade" | "paketleme" | "montaj" | "kesim" | "stok" | "kontrol";

export const KALITE_ITEM_TIPI_LABEL: Record<KaliteItemTipi, string> = {
  URUN: "Ürün",
  YARI_MAMUL: "Yarı Mamul",
  PLAKA: "Plaka (MDF)",
};

export const KALITE_KAYNAK_LABEL: Record<KaliteKaynak, string> = {
  iade: "İade",
  paketleme: "Paketleme",
  montaj: "Montaj",
  kesim: "Kesim",
  stok: "Stok",
  kontrol: "Kontrol",
};

export const KARGO_FIRMALARI = [
  "Yurtiçi",
  "Aras",
  "MNG",
  "Sürat",
  "PTT",
  "UPS",
  "DHL",
  "Trendyol Express",
  "HepsiJET",
  "Diğer",
] as const;

/** Buton renkleri (outline) — Uygunsuz: warning, Kontrol: info, Fire: error, Dönüştür: success */
export const KALITE_BUTTON_CLASS = {
  uygunsuz: "border-[#f28a19] text-[#f28a19] hover:bg-[#f28a19]/10 hover:text-[#f28a19]",
  kontrol: "border-[#3368b1] text-[#3368b1] hover:bg-[#3368b1]/10 hover:text-[#3368b1]",
  fire: "border-[#ee7683] text-[#ee7683] hover:bg-[#ee7683]/10 hover:text-[#ee7683]",
  donustur: "border-[#70c1aa] text-[#3d8f77] hover:bg-[#70c1aa]/10 hover:text-[#3d8f77]",
} as const;
