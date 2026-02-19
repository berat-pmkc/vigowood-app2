// Will be auto-generated after all migrations with:
// npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Manual types for Katman 1-4

export type UserRole =
  | "Yönetici"
  | "Endüstri Mühendisi"
  | "E-Ticaret Müdürü"
  | "Dış Ticaret Müdürü"
  | "Üretim"
  | "Hat"
  | "Muhasebe"
  | "Sevkiyat Sorumlusu"
  | "Pazaryeri Sorumlusu"
  | "Mimar";

export type Station =
  | "Yönetim"
  | "Ofis"
  | "Kesim"
  | "Temizlik"
  | "Montaj"
  | "Paketleme"
  | "Kutu"
  | "Kesim Hattı"
  | "Temilik Hattı"
  | "Montaj Hattı"
  | "Paketleme Hattı"
  | "Kutu Hattı";

export type ProductCategory =
  | "AT EVİ"
  | "TELEFON STANDI"
  | "KİTAP OKUMA STANDI"
  | "BASAMAK"
  | "LAPTOP SEHPASI"
  | "KABAK LİFİ"
  | "KİTAPLIK"
  | "MİNDER"
  | "ORGANİZER"
  | "TABLO";

export type PartType = "HAZIR" | "KUTU" | "KARTON" | "YARIMAMUL";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string;
          auth_id: string | null;
          email: string | null;
          full_name: string;
          role: UserRole;
          station: Station;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          auth_id?: string | null;
          email?: string | null;
          full_name: string;
          role: UserRole;
          station: Station;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          auth_id?: string | null;
          email?: string | null;
          full_name?: string;
          role?: UserRole;
          station?: Station;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          sku: string;
          kategori: ProductCategory | null;
          urun_adi: string | null;
          aktif_mi: boolean;
          stok_aktif: number;
          toplam_satis: number;
          ilk_satis_tarihi: string | null;
          satilan_gun_sayisi: number;
          gunluk_satis: number;
          gecen_ay_uretim: number;
          aylik_uretim: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          sku: string;
          kategori?: ProductCategory | null;
          urun_adi?: string | null;
          aktif_mi?: boolean;
          stok_aktif?: number;
          toplam_satis?: number;
          ilk_satis_tarihi?: string | null;
          satilan_gun_sayisi?: number;
          gunluk_satis?: number;
          gecen_ay_uretim?: number;
          aylik_uretim?: number;
        };
        Update: {
          sku?: string;
          kategori?: ProductCategory | null;
          urun_adi?: string | null;
          aktif_mi?: boolean;
          stok_aktif?: number;
          toplam_satis?: number;
          ilk_satis_tarihi?: string | null;
          satilan_gun_sayisi?: number;
          gunluk_satis?: number;
          gecen_ay_uretim?: number;
          aylik_uretim?: number;
        };
        Relationships: [];
      };
      all_parts: {
        Row: {
          part_id: string;
          part_adi: string;
          part_type: PartType;
          hazir_eleman_aktif_stok: number;
          hazir_eleman_kritik_stok: number;
          yari_mamul_stok: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          part_id: string;
          part_adi: string;
          part_type: PartType;
          hazir_eleman_aktif_stok?: number;
          hazir_eleman_kritik_stok?: number;
          yari_mamul_stok?: number;
        };
        Update: {
          part_id?: string;
          part_adi?: string;
          part_type?: PartType;
          hazir_eleman_aktif_stok?: number;
          hazir_eleman_kritik_stok?: number;
          yari_mamul_stok?: number;
        };
        Relationships: [];
      };
      kesim_makinesi: {
        Row: {
          makine_id: string;
          tipi: string;
          aciklama: string | null;
          created_at: string;
        };
        Insert: {
          makine_id: string;
          tipi: string;
          aciklama?: string | null;
        };
        Update: {
          makine_id?: string;
          tipi?: string;
          aciklama?: string | null;
        };
        Relationships: [];
      };
      plakalar: {
        Row: {
          plakalar_id: string;
          plaka_id: string;
          plaka_adi: string;
          sku: string | null;
          tipi: string | null;
          renk: string | null;
          makine_id: string;
          std_kesim_suresi_dk: number | null;
          created_at: string;
        };
        Insert: {
          plakalar_id: string;
          plaka_id: string;
          plaka_adi: string;
          sku?: string | null;
          tipi?: string | null;
          renk?: string | null;
          makine_id: string;
          std_kesim_suresi_dk?: number | null;
        };
        Update: {
          plakalar_id?: string;
          plaka_id?: string;
          plaka_adi?: string;
          sku?: string | null;
          tipi?: string | null;
          renk?: string | null;
          makine_id?: string;
          std_kesim_suresi_dk?: number | null;
        };
        Relationships: [];
      };
      plaka_parts: {
        Row: {
          ppart_id: string;
          plaka_id: string;
          part_id: string;
          default_qty: number | null;
          sku: string | null;
          created_at: string;
        };
        Insert: {
          ppart_id: string;
          plaka_id: string;
          part_id: string;
          default_qty?: number | null;
          sku?: string | null;
        };
        Update: {
          ppart_id?: string;
          plaka_id?: string;
          part_id?: string;
          default_qty?: number | null;
          sku?: string | null;
        };
        Relationships: [];
      };
      assembly_steps: {
        Row: {
          step_id: string;
          sku: string | null;
          step_name: string | null;
          seq_no: number | null;
          is_final_step: boolean;
          created_at: string;
        };
        Insert: {
          step_id: string;
          sku?: string | null;
          step_name?: string | null;
          seq_no?: number | null;
          is_final_step?: boolean;
        };
        Update: {
          step_id?: string;
          sku?: string | null;
          step_name?: string | null;
          seq_no?: number | null;
          is_final_step?: boolean;
        };
        Relationships: [];
      };
      step_bom: {
        Row: {
          step_bom_id: string;
          step_id: string;
          part_id: string;
          qty_per: number;
          kodu: string | null;
          kritik_stok_products: number;
          created_at: string;
        };
        Insert: {
          step_bom_id: string;
          step_id: string;
          part_id: string;
          qty_per?: number;
          kodu?: string | null;
          kritik_stok_products?: number;
        };
        Update: {
          step_bom_id?: string;
          step_id?: string;
          part_id?: string;
          qty_per?: number;
          kodu?: string | null;
          kritik_stok_products?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      station: Station;
      product_category: ProductCategory;
      part_type: PartType;
    };
  };
};
