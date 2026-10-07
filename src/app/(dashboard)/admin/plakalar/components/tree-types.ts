export interface TreeProduct {
  sku: string;
  urun_adi: string | null;
  aktif_mi: boolean;
}

export interface TreePlaka {
  plakalar_id: string;
  plaka_id: string;
  plaka_adi: string;
  tipi: string | null;
  renk: string | null;
  kesim_sureleri: Record<string, number | null>;
  sku: string[];
  created_at: string;
}

export interface TreePlakaPart {
  ppart_id: string;
  plaka_id: string;
  part_id: string;
  default_qty: number | null;
  sku: string | null;
}

export interface TreePart {
  part_id: string;
  part_adi: string;
  part_type: "YARIMAMUL" | "HAZIR" | "KUTU" | "KARTON";
  tur: string | null;
  mdf_tipi: string | null;
  mdf_renk: string | null;
  yari_mamul_stok: number;
  hazir_eleman_aktif_stok: number;
  hazir_eleman_kritik_stok: number;
}

export interface TreeData {
  products: TreeProduct[];
  plakalar: TreePlaka[];
  plakaParts: TreePlakaPart[];
  parts: TreePart[];
}

export const MAKINELER = ["MAK-1", "MAK-2", "MAK-3"] as const;
