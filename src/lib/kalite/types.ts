/** Kalite modülü el yazması tipleri (supabase types.ts yeniden üretilene kadar) */
import type { KaliteItemTipi, KaliteKaynak } from "./constants";

export type { KaliteItemTipi, KaliteKaynak };

export interface KaliteHareketi {
  id: string;
  tarih: string;
  item_tipi: KaliteItemTipi;
  item_id: string;
  item_adi: string | null;
  stok_turu: "UYGUNSUZ" | "FIRE" | "SAGLAM";
  qty: number;
  islem: string;
  kaynak: KaliteKaynak | null;
  source_id: string | null;
  parent_id: string | null;
  step_id: string | null;
  depo_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
  kargo_firmasi: string | null;
  musteri: string | null;
  not_text: string | null;
  created_at: string;
}

export interface KaliteBakiye {
  item_tipi: KaliteItemTipi;
  item_id: string;
  item_adi: string | null;
  uygunsuz_bakiye: number;
  fire_toplam: number;
  kontrol_edilen_toplam: number;
}

export interface KaliteItemOption {
  id: string;
  adi: string | null;
  /** Ürünler için stok, parçalar için ilgili stok */
  stok?: number | null;
  /** uygunsuz bakiye (kontrol listesinde) */
  uygunsuz?: number;
  partType?: string | null;
}

export interface UrunParcasi {
  part_id: string;
  part_adi: string | null;
  part_type: string;
  qty_per: number;
}

export interface DepoOption {
  depo_id: string;
  ad: string;
}

export type KaliteActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };
