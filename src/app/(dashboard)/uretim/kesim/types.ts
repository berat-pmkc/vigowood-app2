export interface CutBatchRow {
  cut_id: string;
  tarih: string;
  sku: string | null;
  plaka_id: string | null;
  makine_id: string | null;
  adet: number;
  operator_id: string | null;
  plk_notu: string | null;
  durum: string;
  baslama_zamani: string | null;
  bitis_zamani: string | null;
  created_at: string;
  // Enriched fields
  plaka_adi?: string;
  urun_adi?: string;
  operator_adi?: string;
}

export interface MdfStokItem {
  part_id: string;
  part_adi: string | null;
  hazir_eleman_aktif_stok: number;
  hazir_eleman_kritik_stok: number | null;
}

export interface MachineStatusEntry {
  makine_id: string;
  durum: "aktif" | "bakim";
  neden: string | null;
  created_at: string;
}

export interface MachineCounts {
  [makineId: string]: number;
}
