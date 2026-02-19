// Will be auto-generated after all migrations with:
// npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Manual types for Katman 1-5

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
      cut_batches: {
        Row: {
          cut_id: string;
          tarih: string;
          sku: string | null;
          plaka_id: string | null;
          makine_id: string | null;
          adet: number;
          operator_id: string | null;
          plk_notu: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          cut_id: string;
          tarih: string;
          sku?: string | null;
          plaka_id?: string | null;
          makine_id?: string | null;
          adet?: number;
          operator_id?: string | null;
          plk_notu?: string | null;
          email?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cut_batches"]["Insert"]>;
        Relationships: [];
      };
      cut_lines: {
        Row: {
          cut_line_id: string;
          cut_id: string;
          tarih: string;
          part_id: string | null;
          adet: number;
          not_text: string | null;
          renk: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          cut_line_id: string;
          cut_id: string;
          tarih: string;
          part_id?: string | null;
          adet?: number;
          not_text?: string | null;
          renk?: string | null;
          email?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cut_lines"]["Insert"]>;
        Relationships: [];
      };
      clean: {
        Row: {
          cutline_id: string;
          clean_batch_id: string;
          start_time: string | null;
          end_time: string | null;
          status: string;
          not_text: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          cutline_id: string;
          clean_batch_id: string;
          start_time?: string | null;
          end_time?: string | null;
          status?: string;
          not_text?: string | null;
          email?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clean"]["Insert"]>;
        Relationships: [];
      };
      pack_events: {
        Row: {
          session_id: string;
          email: string | null;
          tarih: string | null;
          sku: string | null;
          personel: string | null;
          start_time: string | null;
          end_time: string | null;
          qty: number;
          not_text: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          email?: string | null;
          tarih?: string | null;
          sku?: string | null;
          personel?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          qty?: number;
          not_text?: string | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pack_events"]["Insert"]>;
        Relationships: [];
      };
      hazir_eleman_akis: {
        Row: {
          hakis_id: string;
          tarih: string;
          part_id: string | null;
          qty: number;
          operator: string | null;
          created_at: string;
        };
        Insert: {
          hakis_id: string;
          tarih: string;
          part_id?: string | null;
          qty?: number;
          operator?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["hazir_eleman_akis"]["Insert"]>;
        Relationships: [];
      };
      iade_giris: {
        Row: {
          iade_id: string;
          tarih: string | null;
          sku: string | null;
          qty: number;
          durum: string | null;
          created_at: string;
        };
        Insert: {
          iade_id: string;
          tarih?: string | null;
          sku?: string | null;
          qty?: number;
          durum?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["iade_giris"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          att_id: string;
          tarih: string;
          employee: string;
          department: string | null;
          start_time: string | null;
          end_time: string | null;
          not_text: string | null;
          created_at: string;
        };
        Insert: {
          att_id: string;
          tarih: string;
          employee: string;
          department?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          not_text?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          notif_id: string;
          title: string;
          message: string | null;
          target_user: string | null;
          status: string;
          created_by: string | null;
          attachments: string | null;
          created_at: string;
        };
        Insert: {
          notif_id: string;
          title: string;
          message?: string | null;
          target_user?: string | null;
          status?: string;
          created_by?: string | null;
          attachments?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          mov_id: string | null;
          tarih: string | null;
          sku: string | null;
          qty: number;
          source: string | null;
          source_row_id: string | null;
          batch_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mov_id?: string | null;
          tarih?: string | null;
          sku?: string | null;
          qty?: number;
          source?: string | null;
          source_row_id?: string | null;
          batch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
        Relationships: [];
      };
      yari_mamul_stok: {
        Row: {
          yms_id: string;
          tarih: string | null;
          part_id: string | null;
          part_adi: string | null;
          sku: string | null;
          qty: number;
          direction: string | null;
          source: string | null;
          source_id: string | null;
          operator: string | null;
          created_at: string;
        };
        Insert: {
          yms_id: string;
          tarih?: string | null;
          part_id?: string | null;
          part_adi?: string | null;
          sku?: string | null;
          qty?: number;
          direction?: string | null;
          source?: string | null;
          source_id?: string | null;
          operator?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["yari_mamul_stok"]["Insert"]>;
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
