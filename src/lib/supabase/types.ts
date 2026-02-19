// Will be auto-generated after all migrations with:
// npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Manual types for Katman 1-3

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
