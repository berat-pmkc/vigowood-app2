export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      all_parts: {
        Row: {
          created_at: string
          hazir_eleman_aktif_stok: number
          hazir_eleman_kritik_stok: number
          part_adi: string
          part_id: string
          part_type: Database["public"]["Enums"]["part_type"]
          updated_at: string
          yari_mamul_stok: number
        }
        Insert: {
          created_at?: string
          hazir_eleman_aktif_stok?: number
          hazir_eleman_kritik_stok?: number
          part_adi: string
          part_id: string
          part_type: Database["public"]["Enums"]["part_type"]
          updated_at?: string
          yari_mamul_stok?: number
        }
        Update: {
          created_at?: string
          hazir_eleman_aktif_stok?: number
          hazir_eleman_kritik_stok?: number
          part_adi?: string
          part_id?: string
          part_type?: Database["public"]["Enums"]["part_type"]
          updated_at?: string
          yari_mamul_stok?: number
        }
        Relationships: []
      }
      assembly_steps: {
        Row: {
          created_at: string
          is_final_step: boolean
          seq_no: number | null
          sku: string | null
          step_id: string
          step_name: string | null
        }
        Insert: {
          created_at?: string
          is_final_step?: boolean
          seq_no?: number | null
          sku?: string | null
          step_id: string
          step_name?: string | null
        }
        Update: {
          created_at?: string
          is_final_step?: boolean
          seq_no?: number | null
          sku?: string | null
          step_id?: string
          step_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_steps_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      attendance: {
        Row: {
          att_id: string
          created_at: string
          department: string | null
          employee: string
          end_time: string | null
          not_text: string | null
          start_time: string | null
          tarih: string
        }
        Insert: {
          att_id: string
          created_at?: string
          department?: string | null
          employee: string
          end_time?: string | null
          not_text?: string | null
          start_time?: string | null
          tarih: string
        }
        Update: {
          att_id?: string
          created_at?: string
          department?: string | null
          employee?: string
          end_time?: string | null
          not_text?: string | null
          start_time?: string | null
          tarih?: string
        }
        Relationships: []
      }
      clean: {
        Row: {
          clean_batch_id: string
          created_at: string
          cutline_id: string
          email: string | null
          end_time: string | null
          not_text: string | null
          operator_id: string | null
          operator_name: string | null
          start_time: string | null
          status: string
        }
        Insert: {
          clean_batch_id: string
          created_at?: string
          cutline_id: string
          email?: string | null
          end_time?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          start_time?: string | null
          status?: string
        }
        Update: {
          clean_batch_id?: string
          created_at?: string
          cutline_id?: string
          email?: string | null
          end_time?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clean_cutline_id_fkey"
            columns: ["cutline_id"]
            isOneToOne: true
            referencedRelation: "cut_lines"
            referencedColumns: ["cut_line_id"]
          },
        ]
      }
      cut_batches: {
        Row: {
          adet: number
          baslama_zamani: string | null
          bitis_zamani: string | null
          created_at: string
          cut_id: string
          durum: string
          email: string | null
          makine_id: string | null
          operator_id: string | null
          plaka_id: string | null
          plk_notu: string | null
          sku: string | null
          tarih: string
        }
        Insert: {
          adet?: number
          baslama_zamani?: string | null
          bitis_zamani?: string | null
          created_at?: string
          cut_id: string
          durum?: string
          email?: string | null
          makine_id?: string | null
          operator_id?: string | null
          plaka_id?: string | null
          plk_notu?: string | null
          sku?: string | null
          tarih: string
        }
        Update: {
          adet?: number
          baslama_zamani?: string | null
          bitis_zamani?: string | null
          created_at?: string
          cut_id?: string
          durum?: string
          email?: string | null
          makine_id?: string | null
          operator_id?: string | null
          plaka_id?: string | null
          plk_notu?: string | null
          sku?: string | null
          tarih?: string
        }
        Relationships: [
          {
            foreignKeyName: "cut_batches_makine_id_fkey"
            columns: ["makine_id"]
            isOneToOne: false
            referencedRelation: "kesim_makinesi"
            referencedColumns: ["makine_id"]
          },
        ]
      }
      cut_lines: {
        Row: {
          adet: number
          created_at: string
          cut_id: string
          cut_line_id: string
          email: string | null
          not_text: string | null
          part_id: string | null
          renk: string | null
          tarih: string
        }
        Insert: {
          adet?: number
          created_at?: string
          cut_id: string
          cut_line_id: string
          email?: string | null
          not_text?: string | null
          part_id?: string | null
          renk?: string | null
          tarih: string
        }
        Update: {
          adet?: number
          created_at?: string
          cut_id?: string
          cut_line_id?: string
          email?: string | null
          not_text?: string | null
          part_id?: string | null
          renk?: string | null
          tarih?: string
        }
        Relationships: [
          {
            foreignKeyName: "cut_lines_cut_id_fkey"
            columns: ["cut_id"]
            isOneToOne: false
            referencedRelation: "cut_batches"
            referencedColumns: ["cut_id"]
          },
        ]
      }
      doviz_kurlari: {
        Row: {
          created_at: string | null
          eur_try: number | null
          eur_usd: number | null
          gbp_eur: number | null
          gbp_try: number | null
          gbp_usd: number | null
          id: number
          kaynak: string | null
          tarih: string
          usd_try: number | null
        }
        Insert: {
          created_at?: string | null
          eur_try?: number | null
          eur_usd?: number | null
          gbp_eur?: number | null
          gbp_try?: number | null
          gbp_usd?: number | null
          id?: number
          kaynak?: string | null
          tarih?: string
          usd_try?: number | null
        }
        Update: {
          created_at?: string | null
          eur_try?: number | null
          eur_usd?: number | null
          gbp_eur?: number | null
          gbp_try?: number | null
          gbp_usd?: number | null
          id?: number
          kaynak?: string | null
          tarih?: string
          usd_try?: number | null
        }
        Relationships: []
      }
      hazir_eleman_akis: {
        Row: {
          created_at: string
          hakis_id: string
          not_text: string | null
          operator: string | null
          part_id: string | null
          qty: number
          tarih: string
        }
        Insert: {
          created_at?: string
          hakis_id: string
          not_text?: string | null
          operator?: string | null
          part_id?: string | null
          qty?: number
          tarih: string
        }
        Update: {
          created_at?: string
          hakis_id?: string
          not_text?: string | null
          operator?: string | null
          part_id?: string | null
          qty?: number
          tarih?: string
        }
        Relationships: []
      }
      iade_giris: {
        Row: {
          created_at: string
          durum: string | null
          iade_id: string
          iade_nedeni: string | null
          musteri_bilgisi: string | null
          operator: string | null
          qty: number
          sku: string | null
          tarih: string | null
        }
        Insert: {
          created_at?: string
          durum?: string | null
          iade_id: string
          iade_nedeni?: string | null
          musteri_bilgisi?: string | null
          operator?: string | null
          qty?: number
          sku?: string | null
          tarih?: string | null
        }
        Update: {
          created_at?: string
          durum?: string | null
          iade_id?: string
          iade_nedeni?: string | null
          musteri_bilgisi?: string | null
          operator?: string | null
          qty?: number
          sku?: string | null
          tarih?: string | null
        }
        Relationships: []
      }
      kesim_makinesi: {
        Row: {
          aciklama: string | null
          created_at: string
          makine_id: string
          tipi: string
        }
        Insert: {
          aciklama?: string | null
          created_at?: string
          makine_id: string
          tipi: string
        }
        Update: {
          aciklama?: string | null
          created_at?: string
          makine_id?: string
          tipi?: string
        }
        Relationships: []
      }
      kutu_uretim: {
        Row: {
          bitis_zamani: string | null
          created_at: string | null
          durum: string
          email: string | null
          not_text: string | null
          operator_id: string | null
          operator_name: string | null
          part_adi: string | null
          part_id: string | null
          part_type: string | null
          qty: number
          session_id: string
          start_time: string | null
          tarih: string | null
        }
        Insert: {
          bitis_zamani?: string | null
          created_at?: string | null
          durum?: string
          email?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          part_adi?: string | null
          part_id?: string | null
          part_type?: string | null
          qty?: number
          session_id: string
          start_time?: string | null
          tarih?: string | null
        }
        Update: {
          bitis_zamani?: string | null
          created_at?: string | null
          durum?: string
          email?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          part_adi?: string | null
          part_id?: string | null
          part_type?: string | null
          qty?: number
          session_id?: string
          start_time?: string | null
          tarih?: string | null
        }
        Relationships: []
      }
      montaj_batches: {
        Row: {
          adet: number
          baslama_zamani: string | null
          bitis_zamani: string | null
          created_at: string
          current_step_no: number | null
          durum: string
          email: string | null
          montaj_id: string
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          sku: string
          total_steps: number | null
        }
        Insert: {
          adet?: number
          baslama_zamani?: string | null
          bitis_zamani?: string | null
          created_at?: string
          current_step_no?: number | null
          durum?: string
          email?: string | null
          montaj_id: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          sku: string
          total_steps?: number | null
        }
        Update: {
          adet?: number
          baslama_zamani?: string | null
          bitis_zamani?: string | null
          created_at?: string
          current_step_no?: number | null
          durum?: string
          email?: string | null
          montaj_id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          sku?: string
          total_steps?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attachments: string | null
          created_at: string
          created_by: string | null
          message: string | null
          notif_id: string
          status: string
          target_user: string | null
          title: string
        }
        Insert: {
          attachments?: string | null
          created_at?: string
          created_by?: string | null
          message?: string | null
          notif_id: string
          status?: string
          target_user?: string | null
          title: string
        }
        Update: {
          attachments?: string | null
          created_at?: string
          created_by?: string | null
          message?: string | null
          notif_id?: string
          status?: string
          target_user?: string | null
          title?: string
        }
        Relationships: []
      }
      pack_events: {
        Row: {
          created_at: string
          durum: string
          email: string | null
          end_time: string | null
          not_text: string | null
          operator_id: string | null
          operator_name: string | null
          personel: string | null
          qty: number
          session_id: string
          sku: string | null
          start_time: string | null
          status: string
          tarih: string | null
        }
        Insert: {
          created_at?: string
          durum?: string
          email?: string | null
          end_time?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          personel?: string | null
          qty?: number
          session_id: string
          sku?: string | null
          start_time?: string | null
          status?: string
          tarih?: string | null
        }
        Update: {
          created_at?: string
          durum?: string
          email?: string | null
          end_time?: string | null
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          personel?: string | null
          qty?: number
          session_id?: string
          sku?: string | null
          start_time?: string | null
          status?: string
          tarih?: string | null
        }
        Relationships: []
      }
      plaka_parts: {
        Row: {
          created_at: string
          default_qty: number | null
          part_id: string
          plaka_id: string
          ppart_id: string
          sku: string | null
        }
        Insert: {
          created_at?: string
          default_qty?: number | null
          part_id: string
          plaka_id: string
          ppart_id: string
          sku?: string | null
        }
        Update: {
          created_at?: string
          default_qty?: number | null
          part_id?: string
          plaka_id?: string
          ppart_id?: string
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaka_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "all_parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "plaka_parts_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      plakalar: {
        Row: {
          created_at: string
          makine_id: string
          plaka_adi: string
          plaka_id: string
          plakalar_id: string
          renk: string | null
          sku: string | null
          std_kesim_suresi_dk: number | null
          tipi: string | null
        }
        Insert: {
          created_at?: string
          makine_id: string
          plaka_adi: string
          plaka_id: string
          plakalar_id: string
          renk?: string | null
          sku?: string | null
          std_kesim_suresi_dk?: number | null
          tipi?: string | null
        }
        Update: {
          created_at?: string
          makine_id?: string
          plaka_adi?: string
          plaka_id?: string
          plakalar_id?: string
          renk?: string | null
          sku?: string | null
          std_kesim_suresi_dk?: number | null
          tipi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plakalar_makine_id_fkey"
            columns: ["makine_id"]
            isOneToOne: false
            referencedRelation: "kesim_makinesi"
            referencedColumns: ["makine_id"]
          },
          {
            foreignKeyName: "plakalar_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      products: {
        Row: {
          aktif_mi: boolean
          aylik_uretim: number
          created_at: string
          gecen_ay_uretim: number
          gunluk_satis: number
          ilk_satis_tarihi: string | null
          kategori: Database["public"]["Enums"]["product_category"] | null
          mamul_stok_kritik: number
          satilan_gun_sayisi: number
          sku: string
          stok_aktif: number
          toplam_satis: number
          updated_at: string
          urun_adi: string | null
        }
        Insert: {
          aktif_mi?: boolean
          aylik_uretim?: number
          created_at?: string
          gecen_ay_uretim?: number
          gunluk_satis?: number
          ilk_satis_tarihi?: string | null
          kategori?: Database["public"]["Enums"]["product_category"] | null
          mamul_stok_kritik?: number
          satilan_gun_sayisi?: number
          sku: string
          stok_aktif?: number
          toplam_satis?: number
          updated_at?: string
          urun_adi?: string | null
        }
        Update: {
          aktif_mi?: boolean
          aylik_uretim?: number
          created_at?: string
          gecen_ay_uretim?: number
          gunluk_satis?: number
          ilk_satis_tarihi?: string | null
          kategori?: Database["public"]["Enums"]["product_category"] | null
          mamul_stok_kritik?: number
          satilan_gun_sayisi?: number
          sku?: string
          stok_aktif?: number
          toplam_satis?: number
          updated_at?: string
          urun_adi?: string | null
        }
        Relationships: []
      }
      sevkiyat: {
        Row: {
          alici_firma_id: number | null
          arac_tipi: string | null
          banka_firma_id: number | null
          country_code: string | null
          created_at: string
          durum: string
          email: string | null
          gerceklesen_sevk_tarihi: string | null
          gonderim_zamani: string | null
          hazirlama_zamani: string | null
          ihracatci_firma_id: number | null
          konteyner_no: string | null
          konteyner_tipi: string | null
          liman: string | null
          musteri: string
          not_text: string | null
          operator_id: string | null
          operator_name: string | null
          planlanan_sevk_tarihi: string | null
          sevk_tarihi: string | null
          sevkiyat_adi: string | null
          sevkiyat_id: string
          shipment_number: number | null
          teslim_zamani: string | null
          teslimat_tipi: string | null
          tir_plaka: string | null
          ulke: string | null
          updated_at: string
        }
        Insert: {
          alici_firma_id?: number | null
          arac_tipi?: string | null
          banka_firma_id?: number | null
          country_code?: string | null
          created_at?: string
          durum?: string
          email?: string | null
          gerceklesen_sevk_tarihi?: string | null
          gonderim_zamani?: string | null
          hazirlama_zamani?: string | null
          ihracatci_firma_id?: number | null
          konteyner_no?: string | null
          konteyner_tipi?: string | null
          liman?: string | null
          musteri: string
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          planlanan_sevk_tarihi?: string | null
          sevk_tarihi?: string | null
          sevkiyat_adi?: string | null
          sevkiyat_id: string
          shipment_number?: number | null
          teslim_zamani?: string | null
          teslimat_tipi?: string | null
          tir_plaka?: string | null
          ulke?: string | null
          updated_at?: string
        }
        Update: {
          alici_firma_id?: number | null
          arac_tipi?: string | null
          banka_firma_id?: number | null
          country_code?: string | null
          created_at?: string
          durum?: string
          email?: string | null
          gerceklesen_sevk_tarihi?: string | null
          gonderim_zamani?: string | null
          hazirlama_zamani?: string | null
          ihracatci_firma_id?: number | null
          konteyner_no?: string | null
          konteyner_tipi?: string | null
          liman?: string | null
          musteri?: string
          not_text?: string | null
          operator_id?: string | null
          operator_name?: string | null
          planlanan_sevk_tarihi?: string | null
          sevk_tarihi?: string | null
          sevkiyat_adi?: string | null
          sevkiyat_id?: string
          shipment_number?: number | null
          teslim_zamani?: string | null
          teslimat_tipi?: string | null
          tir_plaka?: string | null
          ulke?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sevkiyat_alici_firma_id_fkey"
            columns: ["alici_firma_id"]
            isOneToOne: false
            referencedRelation: "sevkiyat_firmalar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sevkiyat_banka_firma_id_fkey"
            columns: ["banka_firma_id"]
            isOneToOne: false
            referencedRelation: "sevkiyat_firmalar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sevkiyat_ihracatci_firma_id_fkey"
            columns: ["ihracatci_firma_id"]
            isOneToOne: false
            referencedRelation: "sevkiyat_firmalar"
            referencedColumns: ["id"]
          },
        ]
      }
      sevkiyat_firmalar: {
        Row: {
          adres_satir1: string | null
          adres_satir2: string | null
          aktif: boolean | null
          banka_adi: string | null
          country_code: string | null
          created_at: string | null
          email: string | null
          firma_adi: string | null
          firma_tipi: string
          iban: string | null
          id: number
          imza_yeri: string | null
          para_birimi: string | null
          profil_adi: string
          sevk_yontemi: string | null
          sube_adi: string | null
          swift_code: string | null
          telefon: string | null
          updated_at: string | null
          varsayilan: boolean | null
          vat_no: string | null
          vergi_no: string | null
          web: string | null
          yetkili_adi: string | null
        }
        Insert: {
          adres_satir1?: string | null
          adres_satir2?: string | null
          aktif?: boolean | null
          banka_adi?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          firma_adi?: string | null
          firma_tipi: string
          iban?: string | null
          id?: number
          imza_yeri?: string | null
          para_birimi?: string | null
          profil_adi: string
          sevk_yontemi?: string | null
          sube_adi?: string | null
          swift_code?: string | null
          telefon?: string | null
          updated_at?: string | null
          varsayilan?: boolean | null
          vat_no?: string | null
          vergi_no?: string | null
          web?: string | null
          yetkili_adi?: string | null
        }
        Update: {
          adres_satir1?: string | null
          adres_satir2?: string | null
          aktif?: boolean | null
          banka_adi?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          firma_adi?: string | null
          firma_tipi?: string
          iban?: string | null
          id?: number
          imza_yeri?: string | null
          para_birimi?: string | null
          profil_adi?: string
          sevk_yontemi?: string | null
          sube_adi?: string | null
          swift_code?: string | null
          telefon?: string | null
          updated_at?: string | null
          varsayilan?: boolean | null
          vat_no?: string | null
          vergi_no?: string | null
          web?: string | null
          yetkili_adi?: string | null
        }
        Relationships: []
      }
      sevkiyat_fiyatlar: {
        Row: {
          asin: string | null
          birim_fiyat: number
          country_code: string
          created_at: string
          gtip: string | null
          id: number
          kategori: string | null
          package_qty: number | null
          sku: string
          updated_at: string
          urun_adi_en: string | null
        }
        Insert: {
          asin?: string | null
          birim_fiyat?: number
          country_code: string
          created_at?: string
          gtip?: string | null
          id?: number
          kategori?: string | null
          package_qty?: number | null
          sku: string
          updated_at?: string
          urun_adi_en?: string | null
        }
        Update: {
          asin?: string | null
          birim_fiyat?: number
          country_code?: string
          created_at?: string
          gtip?: string | null
          id?: number
          kategori?: string | null
          package_qty?: number | null
          sku?: string
          updated_at?: string
          urun_adi_en?: string | null
        }
        Relationships: []
      }
      sevkiyat_items: {
        Row: {
          agirlik: number | null
          birim_fiyat: number | null
          boy: number | null
          created_at: string
          desi: number | null
          en: number | null
          grup: string | null
          hacim: number | null
          item_id: string
          koli_adedi: number | null
          koli_agirlik: number | null
          palet_boyut: string | null
          palet_sayisi: number | null
          palet_yukseklik: number | null
          palette_koli: number | null
          qty: number
          sevkiyat_id: string
          sku: string
          toplam_fiyat: number | null
          toplam_koli: number | null
          urun_adi: string | null
          yuk: number | null
        }
        Insert: {
          agirlik?: number | null
          birim_fiyat?: number | null
          boy?: number | null
          created_at?: string
          desi?: number | null
          en?: number | null
          grup?: string | null
          hacim?: number | null
          item_id: string
          koli_adedi?: number | null
          koli_agirlik?: number | null
          palet_boyut?: string | null
          palet_sayisi?: number | null
          palet_yukseklik?: number | null
          palette_koli?: number | null
          qty?: number
          sevkiyat_id: string
          sku: string
          toplam_fiyat?: number | null
          toplam_koli?: number | null
          urun_adi?: string | null
          yuk?: number | null
        }
        Update: {
          agirlik?: number | null
          birim_fiyat?: number | null
          boy?: number | null
          created_at?: string
          desi?: number | null
          en?: number | null
          grup?: string | null
          hacim?: number | null
          item_id?: string
          koli_adedi?: number | null
          koli_agirlik?: number | null
          palet_boyut?: string | null
          palet_sayisi?: number | null
          palet_yukseklik?: number | null
          palette_koli?: number | null
          qty?: number
          sevkiyat_id?: string
          sku?: string
          toplam_fiyat?: number | null
          toplam_koli?: number | null
          urun_adi?: string | null
          yuk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sevkiyat_items_sevkiyat_id_fkey"
            columns: ["sevkiyat_id"]
            isOneToOne: false
            referencedRelation: "sevkiyat"
            referencedColumns: ["sevkiyat_id"]
          },
        ]
      }
      sevkiyat_maliyetler: {
        Row: {
          amazon_pickup: number | null
          amazon_pickup_currency: string | null
          ara_depo: number | null
          ara_depo_currency: string | null
          created_at: string | null
          diger: number | null
          diger_currency: string | null
          ic_nakliye: number | null
          ic_nakliye_currency: string | null
          id: number
          navlun: number | null
          navlun_currency: string | null
          not_text: string | null
          sevkiyat_id: string
          tr_gumruk: number | null
          tr_gumruk_currency: string | null
          updated_at: string | null
          ydg: number | null
          ydg_currency: string | null
        }
        Insert: {
          amazon_pickup?: number | null
          amazon_pickup_currency?: string | null
          ara_depo?: number | null
          ara_depo_currency?: string | null
          created_at?: string | null
          diger?: number | null
          diger_currency?: string | null
          ic_nakliye?: number | null
          ic_nakliye_currency?: string | null
          id?: number
          navlun?: number | null
          navlun_currency?: string | null
          not_text?: string | null
          sevkiyat_id: string
          tr_gumruk?: number | null
          tr_gumruk_currency?: string | null
          updated_at?: string | null
          ydg?: number | null
          ydg_currency?: string | null
        }
        Update: {
          amazon_pickup?: number | null
          amazon_pickup_currency?: string | null
          ara_depo?: number | null
          ara_depo_currency?: string | null
          created_at?: string | null
          diger?: number | null
          diger_currency?: string | null
          ic_nakliye?: number | null
          ic_nakliye_currency?: string | null
          id?: number
          navlun?: number | null
          navlun_currency?: string | null
          not_text?: string | null
          sevkiyat_id?: string
          tr_gumruk?: number | null
          tr_gumruk_currency?: string | null
          updated_at?: string | null
          ydg?: number | null
          ydg_currency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sevkiyat_maliyetler_sevkiyat_id_fkey"
            columns: ["sevkiyat_id"]
            isOneToOne: true
            referencedRelation: "sevkiyat"
            referencedColumns: ["sevkiyat_id"]
          },
        ]
      }
      sevkiyat_palet_sablon: {
        Row: {
          boy: number
          country_code: string
          created_at: string | null
          en: number
          id: number
          koli_adedi: number
          koli_agirlik: number
          palet_boyut: string
          palet_yukseklik: number
          palette_koli: number
          sku: string
          updated_at: string | null
          urun_adi: string | null
          yuk: number
        }
        Insert: {
          boy: number
          country_code: string
          created_at?: string | null
          en: number
          id?: number
          koli_adedi: number
          koli_agirlik: number
          palet_boyut: string
          palet_yukseklik: number
          palette_koli: number
          sku: string
          updated_at?: string | null
          urun_adi?: string | null
          yuk: number
        }
        Update: {
          boy?: number
          country_code?: string
          created_at?: string | null
          en?: number
          id?: number
          koli_adedi?: number
          koli_agirlik?: number
          palet_boyut?: string
          palet_yukseklik?: number
          palette_koli?: number
          sku?: string
          updated_at?: string | null
          urun_adi?: string | null
          yuk?: number
        }
        Relationships: []
      }
      step_bom: {
        Row: {
          created_at: string
          kodu: string | null
          kritik_stok_products: number | null
          part_id: string
          qty_per: number
          step_bom_id: string
          step_id: string
        }
        Insert: {
          created_at?: string
          kodu?: string | null
          kritik_stok_products?: number | null
          part_id: string
          qty_per?: number
          step_bom_id: string
          step_id: string
        }
        Update: {
          created_at?: string
          kodu?: string | null
          kritik_stok_products?: number | null
          part_id?: string
          qty_per?: number
          step_bom_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_bom_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "assembly_steps"
            referencedColumns: ["step_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          mov_id: string | null
          qty: number
          sku: string | null
          source: string | null
          source_row_id: string | null
          tarih: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          mov_id?: string | null
          qty?: number
          sku?: string | null
          source?: string | null
          source_row_id?: string | null
          tarih?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          mov_id?: string | null
          qty?: number
          sku?: string | null
          source?: string | null
          source_row_id?: string | null
          tarih?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string
          email: string | null
          full_name: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          station: Database["public"]["Enums"]["station"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          is_active?: boolean
          role: Database["public"]["Enums"]["user_role"]
          station: Database["public"]["Enums"]["station"]
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          station?: Database["public"]["Enums"]["station"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      yari_mamul_stok: {
        Row: {
          created_at: string
          direction: string | null
          operator: string | null
          part_adi: string | null
          part_id: string | null
          qty: number
          sku: string | null
          source: string | null
          source_id: string | null
          tarih: string | null
          yms_id: string
        }
        Insert: {
          created_at?: string
          direction?: string | null
          operator?: string | null
          part_adi?: string | null
          part_id?: string | null
          qty?: number
          sku?: string | null
          source?: string | null
          source_id?: string | null
          tarih?: string | null
          yms_id: string
        }
        Update: {
          created_at?: string
          direction?: string | null
          operator?: string | null
          part_adi?: string | null
          part_id?: string | null
          qty?: number
          sku?: string | null
          source?: string | null
          source_id?: string | null
          tarih?: string | null
          yms_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_production_access: { Args: never; Returns: boolean }
      has_sevkiyat_access: { Args: never; Returns: boolean }
      has_stock_access: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_engineer: { Args: never; Returns: boolean }
      next_sevkiyat_item_id: { Args: never; Returns: string }
    }
    Enums: {
      part_type: "HAZIR" | "KUTU" | "KARTON" | "YARIMAMUL"
      product_category:
        | "AT EVİ"
        | "TELEFON STANDI"
        | "KİTAP OKUMA STANDI"
        | "BASAMAK"
        | "LAPTOP SEHPASI"
        | "KABAK LİFİ"
        | "KİTAPLIK"
        | "MİNDER"
        | "ORGANİZER"
        | "TABLO"
      station:
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
        | "Kutu Hattı"
      user_role:
        | "Yönetici"
        | "Endüstri Mühendisi"
        | "E-Ticaret Müdürü"
        | "Dış Ticaret Müdürü"
        | "Üretim"
        | "Hat"
        | "Muhasebe"
        | "Sevkiyat Sorumlusu"
        | "Pazaryeri Sorumlusu"
        | "Mimar"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      part_type: ["HAZIR", "KUTU", "KARTON", "YARIMAMUL"],
      product_category: [
        "AT EVİ",
        "TELEFON STANDI",
        "KİTAP OKUMA STANDI",
        "BASAMAK",
        "LAPTOP SEHPASI",
        "KABAK LİFİ",
        "KİTAPLIK",
        "MİNDER",
        "ORGANİZER",
        "TABLO",
      ],
      station: [
        "Yönetim",
        "Ofis",
        "Kesim",
        "Temizlik",
        "Montaj",
        "Paketleme",
        "Kutu",
        "Kesim Hattı",
        "Temilik Hattı",
        "Montaj Hattı",
        "Paketleme Hattı",
        "Kutu Hattı",
      ],
      user_role: [
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
      ],
    },
  },
} as const

// Custom type aliases
export type UserRole = Database["public"]["Enums"]["user_role"];
export type ProductCategory = Database["public"]["Enums"]["product_category"];
export type PartType = Database["public"]["Enums"]["part_type"];
export type Station = "Kesim" | "Temizlik" | "Montaj" | "Paketleme" | "Kutu";
