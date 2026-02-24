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
          mdf_renk: string | null
          mdf_tipi: string | null
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
          mdf_renk?: string | null
          mdf_tipi?: string | null
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
          mdf_renk?: string | null
          mdf_tipi?: string | null
          part_adi?: string
          part_id?: string
          part_type?: Database["public"]["Enums"]["part_type"]
          updated_at?: string
          yari_mamul_stok?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
          pln_try: number | null
          sek_try: number | null
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
          pln_try?: number | null
          sek_try?: number | null
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
          pln_try?: number | null
          sek_try?: number | null
          tarih?: string
          usd_try?: number | null
        }
        Relationships: []
      }
      faaliyet_donemler: {
        Row: {
          ay_no: number
          ceyrek: string
          created_at: string | null
          donem_kodu: string
          donem_label: string | null
          id: string
          kur_tl_usd: number | null
          updated_at: string | null
          yari_yil: string
          yil: number
        }
        Insert: {
          ay_no: number
          ceyrek: string
          created_at?: string | null
          donem_kodu: string
          donem_label?: string | null
          id?: string
          kur_tl_usd?: number | null
          updated_at?: string | null
          yari_yil: string
          yil: number
        }
        Update: {
          ay_no?: number
          ceyrek?: string
          created_at?: string | null
          donem_kodu?: string
          donem_label?: string | null
          id?: string
          kur_tl_usd?: number | null
          updated_at?: string | null
          yari_yil?: string
          yil?: number
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
      kampanyalar: {
        Row: {
          aktif_mi: boolean
          ana_hedef: string | null
          baslangic_tarihi: string
          bitis_tarihi: string
          ciro: number | null
          created_at: string
          donusum_orani: number | null
          id: string
          kampanya_adi: string
          kodu: string
          notlar: string | null
          ortalama_sepet: number | null
          siparis_sayisi: number | null
          updated_at: string
          ziyaretci: number | null
        }
        Insert: {
          aktif_mi?: boolean
          ana_hedef?: string | null
          baslangic_tarihi: string
          bitis_tarihi: string
          ciro?: number | null
          created_at?: string
          donusum_orani?: number | null
          id?: string
          kampanya_adi: string
          kodu: string
          notlar?: string | null
          ortalama_sepet?: number | null
          siparis_sayisi?: number | null
          updated_at?: string
          ziyaretci?: number | null
        }
        Update: {
          aktif_mi?: boolean
          ana_hedef?: string | null
          baslangic_tarihi?: string
          bitis_tarihi?: string
          ciro?: number | null
          created_at?: string
          donusum_orani?: number | null
          id?: string
          kampanya_adi?: string
          kodu?: string
          notlar?: string | null
          ortalama_sepet?: number | null
          siparis_sayisi?: number | null
          updated_at?: string
          ziyaretci?: number | null
        }
        Relationships: []
      }
      karlilik_data: {
        Row: {
          aciklama: string | null
          aktarim_tarihi: string | null
          created_at: string | null
          donem_id: string
          id: string
          kalem: string
          kalem_turu: Database["public"]["Enums"]["kalem_turu"]
          marka: string
          ortalama_kur: number | null
          sira: number
          tl: number | null
          updated_at: string | null
          usd: number | null
        }
        Insert: {
          aciklama?: string | null
          aktarim_tarihi?: string | null
          created_at?: string | null
          donem_id: string
          id?: string
          kalem: string
          kalem_turu: Database["public"]["Enums"]["kalem_turu"]
          marka: string
          ortalama_kur?: number | null
          sira?: number
          tl?: number | null
          updated_at?: string | null
          usd?: number | null
        }
        Update: {
          aciklama?: string | null
          aktarim_tarihi?: string | null
          created_at?: string | null
          donem_id?: string
          id?: string
          kalem?: string
          kalem_turu?: Database["public"]["Enums"]["kalem_turu"]
          marka?: string
          ortalama_kur?: number | null
          sira?: number
          tl?: number | null
          updated_at?: string | null
          usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "karlilik_data_donem_id_fkey"
            columns: ["donem_id"]
            isOneToOne: false
            referencedRelation: "faaliyet_donemler"
            referencedColumns: ["id"]
          },
        ]
      }
      kesim_makinesi: {
        Row: {
          aciklama: string | null
          aktif: boolean
          bolum: string
          created_at: string
          makine_id: string
          tipi: string
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          aktif?: boolean
          bolum?: string
          created_at?: string
          makine_id: string
          tipi: string
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          aktif?: boolean
          bolum?: string
          created_at?: string
          makine_id?: string
          tipi?: string
          updated_at?: string
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
          plaka_id: string | null
          qty: number
          session_id: string
          sku: string | null
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
          plaka_id?: string | null
          qty?: number
          session_id: string
          sku?: string | null
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
          plaka_id?: string | null
          qty?: number
          session_id?: string
          sku?: string | null
          start_time?: string | null
          tarih?: string | null
        }
        Relationships: []
      }
      maliyet_giris: {
        Row: {
          aktarim_tarihi: string | null
          cari_adi: string | null
          created_at: string | null
          donem_id: string
          id: string
          kategori: string
          kaynak: string | null
          maliyet_grubu: Database["public"]["Enums"]["maliyet_grubu"] | null
          marka: string
          ortalama_kur: number | null
          tl_maliyet: number | null
          tur: Database["public"]["Enums"]["faaliyet_turu"]
          updated_at: string | null
          usd_maliyet: number | null
          vigo_wood_orani: number | null
        }
        Insert: {
          aktarim_tarihi?: string | null
          cari_adi?: string | null
          created_at?: string | null
          donem_id: string
          id?: string
          kategori: string
          kaynak?: string | null
          maliyet_grubu?: Database["public"]["Enums"]["maliyet_grubu"] | null
          marka: string
          ortalama_kur?: number | null
          tl_maliyet?: number | null
          tur?: Database["public"]["Enums"]["faaliyet_turu"]
          updated_at?: string | null
          usd_maliyet?: number | null
          vigo_wood_orani?: number | null
        }
        Update: {
          aktarim_tarihi?: string | null
          cari_adi?: string | null
          created_at?: string | null
          donem_id?: string
          id?: string
          kategori?: string
          kaynak?: string | null
          maliyet_grubu?: Database["public"]["Enums"]["maliyet_grubu"] | null
          marka?: string
          ortalama_kur?: number | null
          tl_maliyet?: number | null
          tur?: Database["public"]["Enums"]["faaliyet_turu"]
          updated_at?: string | null
          usd_maliyet?: number | null
          vigo_wood_orani?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maliyet_giris_donem_id_fkey"
            columns: ["donem_id"]
            isOneToOne: false
            referencedRelation: "faaliyet_donemler"
            referencedColumns: ["id"]
          },
        ]
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
      montaj_sessions: {
        Row: {
          birim_montaj_dk: number | null
          created_at: string | null
          durum: string
          email: string | null
          end_time: string | null
          is_final_step: boolean | null
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          qty: number | null
          seq_no: number | null
          session_id: string
          sku: string
          start_time: string | null
          step_id: string
          step_name: string | null
          updated_at: string | null
          worker_count: number | null
          workers: Json | null
        }
        Insert: {
          birim_montaj_dk?: number | null
          created_at?: string | null
          durum?: string
          email?: string | null
          end_time?: string | null
          is_final_step?: boolean | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          qty?: number | null
          seq_no?: number | null
          session_id: string
          sku: string
          start_time?: string | null
          step_id: string
          step_name?: string | null
          updated_at?: string | null
          worker_count?: number | null
          workers?: Json | null
        }
        Update: {
          birim_montaj_dk?: number | null
          created_at?: string | null
          durum?: string
          email?: string | null
          end_time?: string | null
          is_final_step?: boolean | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          qty?: number | null
          seq_no?: number | null
          session_id?: string
          sku?: string
          start_time?: string | null
          step_id?: string
          step_name?: string | null
          updated_at?: string | null
          worker_count?: number | null
          workers?: Json | null
        }
        Relationships: []
      }
      nakit_cikislar: {
        Row: {
          akaryakit: number | null
          arac_bakim: number | null
          created_at: string | null
          demirbas: number | null
          diger_giderler: number | null
          diger_usd: number | null
          donem_id: string
          doviz_bozdurma_usd: number | null
          elektrik: number | null
          faaliyet_disi_harcamalar: number | null
          gumruk_usd: number | null
          hammadde: number | null
          hukuk: number | null
          id: string
          kredi_karti: number | null
          kredi_odemesi: number | null
          maas: number | null
          makine_bakim: number | null
          masraf_komisyon: number | null
          muhasebe: number | null
          mutfak: number | null
          nakliye: number | null
          navlun_usd: number | null
          pazaryeri: number | null
          sgk: number | null
          su: number | null
          telekom: number | null
          toplam_tl: number | null
          toplam_yurtdisi_usd: number | null
          updated_at: string | null
          vergi: number | null
        }
        Insert: {
          akaryakit?: number | null
          arac_bakim?: number | null
          created_at?: string | null
          demirbas?: number | null
          diger_giderler?: number | null
          diger_usd?: number | null
          donem_id: string
          doviz_bozdurma_usd?: number | null
          elektrik?: number | null
          faaliyet_disi_harcamalar?: number | null
          gumruk_usd?: number | null
          hammadde?: number | null
          hukuk?: number | null
          id?: string
          kredi_karti?: number | null
          kredi_odemesi?: number | null
          maas?: number | null
          makine_bakim?: number | null
          masraf_komisyon?: number | null
          muhasebe?: number | null
          mutfak?: number | null
          nakliye?: number | null
          navlun_usd?: number | null
          pazaryeri?: number | null
          sgk?: number | null
          su?: number | null
          telekom?: number | null
          toplam_tl?: number | null
          toplam_yurtdisi_usd?: number | null
          updated_at?: string | null
          vergi?: number | null
        }
        Update: {
          akaryakit?: number | null
          arac_bakim?: number | null
          created_at?: string | null
          demirbas?: number | null
          diger_giderler?: number | null
          diger_usd?: number | null
          donem_id?: string
          doviz_bozdurma_usd?: number | null
          elektrik?: number | null
          faaliyet_disi_harcamalar?: number | null
          gumruk_usd?: number | null
          hammadde?: number | null
          hukuk?: number | null
          id?: string
          kredi_karti?: number | null
          kredi_odemesi?: number | null
          maas?: number | null
          makine_bakim?: number | null
          masraf_komisyon?: number | null
          muhasebe?: number | null
          mutfak?: number | null
          nakliye?: number | null
          navlun_usd?: number | null
          pazaryeri?: number | null
          sgk?: number | null
          su?: number | null
          telekom?: number | null
          toplam_tl?: number | null
          toplam_yurtdisi_usd?: number | null
          updated_at?: string | null
          vergi?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nakit_cikislar_donem_id_fkey"
            columns: ["donem_id"]
            isOneToOne: true
            referencedRelation: "nakit_donemler"
            referencedColumns: ["id"]
          },
        ]
      }
      nakit_donemler: {
        Row: {
          baslangic_tarihi: string
          bitis_tarihi: string
          created_at: string | null
          donem_kodu: string
          gayrinakit_islem: number | null
          id: string
          kur_bilgisi: number | null
          nakit_cikis_tl: number | null
          nakit_cikis_usd: number | null
          nakit_giris_tl: number | null
          nakit_giris_usd: number | null
          toplam_finansal_borc: number | null
          toplam_kk_borc: number | null
          toplam_piyasa_borcu: number | null
          toplam_varlik_tl: number | null
          updated_at: string | null
          varlik_acilis_tl: number | null
          varlik_acilis_usd: number | null
          varlik_tl: number | null
          varlik_usd: number | null
          yatirim_tl: number | null
        }
        Insert: {
          baslangic_tarihi: string
          bitis_tarihi: string
          created_at?: string | null
          donem_kodu: string
          gayrinakit_islem?: number | null
          id?: string
          kur_bilgisi?: number | null
          nakit_cikis_tl?: number | null
          nakit_cikis_usd?: number | null
          nakit_giris_tl?: number | null
          nakit_giris_usd?: number | null
          toplam_finansal_borc?: number | null
          toplam_kk_borc?: number | null
          toplam_piyasa_borcu?: number | null
          toplam_varlik_tl?: number | null
          updated_at?: string | null
          varlik_acilis_tl?: number | null
          varlik_acilis_usd?: number | null
          varlik_tl?: number | null
          varlik_usd?: number | null
          yatirim_tl?: number | null
        }
        Update: {
          baslangic_tarihi?: string
          bitis_tarihi?: string
          created_at?: string | null
          donem_kodu?: string
          gayrinakit_islem?: number | null
          id?: string
          kur_bilgisi?: number | null
          nakit_cikis_tl?: number | null
          nakit_cikis_usd?: number | null
          nakit_giris_tl?: number | null
          nakit_giris_usd?: number | null
          toplam_finansal_borc?: number | null
          toplam_kk_borc?: number | null
          toplam_piyasa_borcu?: number | null
          toplam_varlik_tl?: number | null
          updated_at?: string | null
          varlik_acilis_tl?: number | null
          varlik_acilis_usd?: number | null
          varlik_tl?: number | null
          varlik_usd?: number | null
          yatirim_tl?: number | null
        }
        Relationships: []
      }
      nakit_giris_takip: {
        Row: {
          cinsi: Database["public"]["Enums"]["para_birimi"] | null
          created_at: string | null
          id: string
          marka: string | null
          odeme_durum: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi: string
          tarih: string | null
          turu: string | null
          tutar: number
          updated_at: string | null
        }
        Insert: {
          cinsi?: Database["public"]["Enums"]["para_birimi"] | null
          created_at?: string | null
          id?: string
          marka?: string | null
          odeme_durum?: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi: string
          tarih?: string | null
          turu?: string | null
          tutar?: number
          updated_at?: string | null
        }
        Update: {
          cinsi?: Database["public"]["Enums"]["para_birimi"] | null
          created_at?: string | null
          id?: string
          marka?: string | null
          odeme_durum?: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi?: string
          tarih?: string | null
          turu?: string | null
          tutar?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      nakit_girisler: {
        Row: {
          amazon: number | null
          amazon_yurtdisi: number | null
          created_at: string | null
          diger_pazaryeri: number | null
          diger_yurtdisi: number | null
          donem_id: string
          doviz_satisi: number | null
          has_mob: number | null
          hepsiburada: number | null
          id: string
          nakit_kredi: number | null
          toplam_tl: number | null
          toplam_yurtdisi: number | null
          trendyol: number | null
          updated_at: string | null
          vigowood_com: number | null
        }
        Insert: {
          amazon?: number | null
          amazon_yurtdisi?: number | null
          created_at?: string | null
          diger_pazaryeri?: number | null
          diger_yurtdisi?: number | null
          donem_id: string
          doviz_satisi?: number | null
          has_mob?: number | null
          hepsiburada?: number | null
          id?: string
          nakit_kredi?: number | null
          toplam_tl?: number | null
          toplam_yurtdisi?: number | null
          trendyol?: number | null
          updated_at?: string | null
          vigowood_com?: number | null
        }
        Update: {
          amazon?: number | null
          amazon_yurtdisi?: number | null
          created_at?: string | null
          diger_pazaryeri?: number | null
          diger_yurtdisi?: number | null
          donem_id?: string
          doviz_satisi?: number | null
          has_mob?: number | null
          hepsiburada?: number | null
          id?: string
          nakit_kredi?: number | null
          toplam_tl?: number | null
          toplam_yurtdisi?: number | null
          trendyol?: number | null
          updated_at?: string | null
          vigowood_com?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nakit_girisler_donem_id_fkey"
            columns: ["donem_id"]
            isOneToOne: true
            referencedRelation: "nakit_donemler"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: number
          notif_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: never
          notif_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: never
          notif_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notif_id_fkey"
            columns: ["notif_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["notif_id"]
          },
        ]
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: []
      }
      odemeler: {
        Row: {
          cinsi: Database["public"]["Enums"]["para_birimi"] | null
          created_at: string | null
          id: string
          kredi_grubu: string | null
          odeme_durum: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi: string
          tarih: string | null
          turu: Database["public"]["Enums"]["odeme_turu"] | null
          tutar: number
          updated_at: string | null
        }
        Insert: {
          cinsi?: Database["public"]["Enums"]["para_birimi"] | null
          created_at?: string | null
          id?: string
          kredi_grubu?: string | null
          odeme_durum?: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi: string
          tarih?: string | null
          turu?: Database["public"]["Enums"]["odeme_turu"] | null
          tutar?: number
          updated_at?: string | null
        }
        Update: {
          cinsi?: Database["public"]["Enums"]["para_birimi"] | null
          created_at?: string | null
          id?: string
          kredi_grubu?: string | null
          odeme_durum?: Database["public"]["Enums"]["odeme_durumu"] | null
          tanimi?: string
          tarih?: string | null
          turu?: Database["public"]["Enums"]["odeme_turu"] | null
          tutar?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pack_events: {
        Row: {
          birim_paketleme_dk: number | null
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
          worker_count: number | null
          workers: Json | null
        }
        Insert: {
          birim_paketleme_dk?: number | null
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
          worker_count?: number | null
          workers?: Json | null
        }
        Update: {
          birim_paketleme_dk?: number | null
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
          worker_count?: number | null
          workers?: Json | null
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
          kesim_sureleri: Json | null
          plaka_adi: string
          plaka_id: string
          plaka_kategori: string
          plakalar_id: string
          renk: string | null
          sku: string | null
          tipi: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          kesim_sureleri?: Json | null
          plaka_adi: string
          plaka_id: string
          plaka_kategori?: string
          plakalar_id: string
          renk?: string | null
          sku?: string | null
          tipi?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          kesim_sureleri?: Json | null
          plaka_adi?: string
          plaka_id?: string
          plaka_kategori?: string
          plakalar_id?: string
          renk?: string | null
          sku?: string | null
          tipi?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          renk_kodu: string | null
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
          renk_kodu?: string | null
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
          renk_kodu?: string | null
          satilan_gun_sayisi?: number
          sku?: string
          stok_aktif?: number
          toplam_satis?: number
          updated_at?: string
          urun_adi?: string | null
        }
        Relationships: []
      }
      satis_giris: {
        Row: {
          aktarim_tarihi: string | null
          created_at: string | null
          donem_id: string
          hesaplanan_tl: number | null
          hesaplanan_usd: number | null
          id: string
          kanal: string
          marka: string
          ortalama_kur: number | null
          pazaryeri: string
          tl_satislar: number | null
          tur: Database["public"]["Enums"]["faaliyet_turu"]
          ulke: string | null
          updated_at: string | null
          usd_satislar: number | null
        }
        Insert: {
          aktarim_tarihi?: string | null
          created_at?: string | null
          donem_id: string
          hesaplanan_tl?: number | null
          hesaplanan_usd?: number | null
          id?: string
          kanal: string
          marka: string
          ortalama_kur?: number | null
          pazaryeri: string
          tl_satislar?: number | null
          tur?: Database["public"]["Enums"]["faaliyet_turu"]
          ulke?: string | null
          updated_at?: string | null
          usd_satislar?: number | null
        }
        Update: {
          aktarim_tarihi?: string | null
          created_at?: string | null
          donem_id?: string
          hesaplanan_tl?: number | null
          hesaplanan_usd?: number | null
          id?: string
          kanal?: string
          marka?: string
          ortalama_kur?: number | null
          pazaryeri?: string
          tl_satislar?: number | null
          tur?: Database["public"]["Enums"]["faaliyet_turu"]
          ulke?: string | null
          updated_at?: string | null
          usd_satislar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "satis_giris_donem_id_fkey"
            columns: ["donem_id"]
            isOneToOne: false
            referencedRelation: "faaliyet_donemler"
            referencedColumns: ["id"]
          },
        ]
      }
      satis_raporlari: {
        Row: {
          created_at: string
          dosya_adi: string | null
          durum: string
          id: string
          ihracat_tutar: number
          rapor_id: string
          rapor_tarihi: string
          toplam_adet: number
          toplam_satir: number
          toplam_tutar: number
          tr_tutar: number
          updated_at: string
          yukleme_tarihi: string
          yukleyen_adi: string | null
          yukleyen_id: string | null
        }
        Insert: {
          created_at?: string
          dosya_adi?: string | null
          durum?: string
          id?: string
          ihracat_tutar?: number
          rapor_id: string
          rapor_tarihi: string
          toplam_adet?: number
          toplam_satir?: number
          toplam_tutar?: number
          tr_tutar?: number
          updated_at?: string
          yukleme_tarihi?: string
          yukleyen_adi?: string | null
          yukleyen_id?: string | null
        }
        Update: {
          created_at?: string
          dosya_adi?: string | null
          durum?: string
          id?: string
          ihracat_tutar?: number
          rapor_id?: string
          rapor_tarihi?: string
          toplam_adet?: number
          toplam_satir?: number
          toplam_tutar?: number
          tr_tutar?: number
          updated_at?: string
          yukleme_tarihi?: string
          yukleyen_adi?: string | null
          yukleyen_id?: string | null
        }
        Relationships: []
      }
      satis_satirlari: {
        Row: {
          birim_fiyat: number
          created_at: string
          doviz: string
          fatura_no: string | null
          id: string
          is_hizmet: boolean
          kdv_orani: number | null
          miktar: number
          musteri_adi: string | null
          rapor_id: string
          satis_kanali: string | null
          sku: string | null
          tarih: string | null
          toplam_tutar: number
        }
        Insert: {
          birim_fiyat?: number
          created_at?: string
          doviz?: string
          fatura_no?: string | null
          id?: string
          is_hizmet?: boolean
          kdv_orani?: number | null
          miktar?: number
          musteri_adi?: string | null
          rapor_id: string
          satis_kanali?: string | null
          sku?: string | null
          tarih?: string | null
          toplam_tutar?: number
        }
        Update: {
          birim_fiyat?: number
          created_at?: string
          doviz?: string
          fatura_no?: string | null
          id?: string
          is_hizmet?: boolean
          kdv_orani?: number | null
          miktar?: number
          musteri_adi?: string | null
          rapor_id?: string
          satis_kanali?: string | null
          sku?: string | null
          tarih?: string | null
          toplam_tutar?: number
        }
        Relationships: [
          {
            foreignKeyName: "satis_satirlari_rapor_id_fkey"
            columns: ["rapor_id"]
            isOneToOne: false
            referencedRelation: "satis_raporlari"
            referencedColumns: ["rapor_id"]
          },
        ]
      }
      sevkiyat: {
        Row: {
          alici_firma_id: number | null
          arac_tipi: string | null
          banka_firma_id: number | null
          country_code: string | null
          created_at: string
          dorse_plaka: string | null
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
          tasiyici_firma: string | null
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
          dorse_plaka?: string | null
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
          tasiyici_firma?: string | null
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
          dorse_plaka?: string | null
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
          tasiyici_firma?: string | null
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
          yuk: number
        }
        Insert: {
          boy: number
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
          yuk: number
        }
        Update: {
          boy?: number
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
      tr_pazarlama: {
        Row: {
          ay: number
          created_at: string
          donusum_orani: number
          gercek_ciro: number
          hedef_ciro: number
          iadeler: number
          id: string
          kodu: string
          not_text: string | null
          ortalama_sepet: number | null
          pazaryeri: string
          reklam_harcamasi: number | null
          siparis_sayisi: number
          updated_at: string
          yil: number
          ziyaretci: number
        }
        Insert: {
          ay: number
          created_at?: string
          donusum_orani?: number
          gercek_ciro?: number
          hedef_ciro?: number
          iadeler?: number
          id?: string
          kodu: string
          not_text?: string | null
          ortalama_sepet?: number | null
          pazaryeri: string
          reklam_harcamasi?: number | null
          siparis_sayisi?: number
          updated_at?: string
          yil: number
          ziyaretci?: number
        }
        Update: {
          ay?: number
          created_at?: string
          donusum_orani?: number
          gercek_ciro?: number
          hedef_ciro?: number
          iadeler?: number
          id?: string
          kodu?: string
          not_text?: string | null
          ortalama_sepet?: number | null
          pazaryeri?: string
          reklam_harcamasi?: number | null
          siparis_sayisi?: number
          updated_at?: string
          yil?: number
          ziyaretci?: number
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
          password_plain: string | null
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
          password_plain?: string | null
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
          password_plain?: string | null
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
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: Database["public"]["Enums"]["task_status"]
          priority: Database["public"]["Enums"]["task_priority"]
          assigned_to: string | null
          created_by: string
          department: Database["public"]["Enums"]["task_department"]
          due_date: string | null
          parent_id: string | null
          source_type: Database["public"]["Enums"]["task_source_type"]
          source_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          assigned_to?: string | null
          created_by: string
          department?: Database["public"]["Enums"]["task_department"]
          due_date?: string | null
          parent_id?: string | null
          source_type?: Database["public"]["Enums"]["task_source_type"]
          source_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          assigned_to?: string | null
          created_by?: string
          department?: Database["public"]["Enums"]["task_department"]
          due_date?: string | null
          parent_id?: string | null
          source_type?: Database["public"]["Enums"]["task_source_type"]
          source_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          id: string
          task_id: string
          file_url: string
          file_name: string
          file_size: number | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          file_url: string
          file_name: string
          file_size?: number | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          file_url?: string
          file_name?: string
          file_size?: number | null
          uploaded_by?: string
          created_at?: string
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          id: string
          task_id: string
          actor_id: string
          action: Database["public"]["Enums"]["task_activity_action"]
          old_value: string | null
          new_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          actor_id: string
          action: Database["public"]["Enums"]["task_activity_action"]
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          actor_id?: string
          action?: Database["public"]["Enums"]["task_activity_action"]
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ops_agents: {
        Row: {
          id: string
          name: string
          code: string
          department: string
          description: string | null
          avatar_url: string | null
          capabilities: Json
          schedule: Json
          status: Database["public"]["Enums"]["agent_status"]
          is_active: boolean
          total_tasks_completed: number
          total_approvals_requested: number
          total_outputs_generated: number
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          department?: string
          description?: string | null
          avatar_url?: string | null
          capabilities?: Json
          schedule?: Json
          status?: Database["public"]["Enums"]["agent_status"]
          is_active?: boolean
          total_tasks_completed?: number
          total_approvals_requested?: number
          total_outputs_generated?: number
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          department?: string
          description?: string | null
          avatar_url?: string | null
          capabilities?: Json
          schedule?: Json
          status?: Database["public"]["Enums"]["agent_status"]
          is_active?: boolean
          total_tasks_completed?: number
          total_approvals_requested?: number
          total_outputs_generated?: number
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_approvals: {
        Row: {
          id: string
          task_id: string | null
          agent_id: string | null
          action_type: Database["public"]["Enums"]["approval_action_type"]
          risk_level: Database["public"]["Enums"]["approval_risk_level"]
          status: Database["public"]["Enums"]["approval_status"]
          title: string
          description: string | null
          requested_by: string
          reviewer_id: string | null
          payload: Json
          old_payload: Json
          review_note: string | null
          requested_at: string
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          agent_id?: string | null
          action_type: Database["public"]["Enums"]["approval_action_type"]
          risk_level?: Database["public"]["Enums"]["approval_risk_level"]
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
          description?: string | null
          requested_by: string
          reviewer_id?: string | null
          payload?: Json
          old_payload?: Json
          review_note?: string | null
          requested_at?: string
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          agent_id?: string | null
          action_type?: Database["public"]["Enums"]["approval_action_type"]
          risk_level?: Database["public"]["Enums"]["approval_risk_level"]
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
          description?: string | null
          requested_by?: string
          reviewer_id?: string | null
          payload?: Json
          old_payload?: Json
          review_note?: string | null
          requested_at?: string
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ops_outputs: {
        Row: {
          id: string
          task_id: string | null
          agent_id: string | null
          file_type: Database["public"]["Enums"]["output_file_type"]
          file_name: string
          file_url: string
          file_size: number | null
          description: string | null
          metadata: Json
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          agent_id?: string | null
          file_type?: Database["public"]["Enums"]["output_file_type"]
          file_name: string
          file_url: string
          file_size?: number | null
          description?: string | null
          metadata?: Json
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          agent_id?: string | null
          file_type?: Database["public"]["Enums"]["output_file_type"]
          file_name?: string
          file_url?: string
          file_size?: number | null
          description?: string | null
          metadata?: Json
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_users_last_sign_in: {
        Args: never
        Returns: {
          auth_id: string
          last_sign_in_at: string
        }[]
      }
      get_user_last_sign_in: { Args: { p_auth_id: string }; Returns: string }
      has_personel_access: { Args: never; Returns: boolean }
      has_production_access: { Args: never; Returns: boolean }
      has_sales_access: { Args: never; Returns: boolean }
      has_sevkiyat_access: { Args: never; Returns: boolean }
      has_stock_access: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_engineer: { Args: never; Returns: boolean }
      is_admin_or_finance: { Args: never; Returns: boolean }
      next_sevkiyat_item_id: { Args: never; Returns: string }
    }
    Enums: {
      faaliyet_turu: "FAALIYET" | "FAALIYET_DISI"
      task_status: "backlog" | "open" | "in_progress" | "waiting_approval" | "blocked" | "done"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_department: "uretim" | "stok" | "sevkiyat" | "muhasebe" | "pazaryeri" | "genel"
      task_source_type: "manual" | "recurring_job" | "alert"
      task_activity_action: "created" | "status_changed" | "assigned" | "commented" | "file_added" | "priority_changed"
      approval_action_type: "task_status_change" | "stock_adjustment" | "shipment_release" | "price_change" | "bulk_operation" | "system_config"
      approval_risk_level: "low" | "medium" | "high" | "critical"
      approval_status: "pending" | "approved" | "rejected" | "revision_requested"
      output_file_type: "report" | "export" | "pdf" | "csv" | "image" | "other"
      agent_status: "active" | "paused" | "disabled"
      kalem_turu:
        | "GELIR"
        | "GIDER"
        | "TOPLAM"
        | "KAR"
        | "MARJ"
        | "FD_GELIR"
        | "FD_GIDER"
      maliyet_grubu: "VIGO_WOOD" | "HAS_MOB" | "ORTAK"
      odeme_durumu: "TAMAMLANDI" | "BEKLİYOR"
      odeme_turu:
        | "PİYASA"
        | "KREDİ"
        | "KREDİ KARTI"
        | "MAAŞ"
        | "FAİZ"
        | "SGK"
        | "VERGİ"
        | "HAMMADDE"
        | "PERSONEL"
        | "ELEKTRİK"
        | "BANKA"
        | "GENEL"
        | "DİĞER"
      para_birimi: "TL" | "USD" | "EUR"
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
      faaliyet_turu: ["FAALIYET", "FAALIYET_DISI"],
      kalem_turu: [
        "GELIR",
        "GIDER",
        "TOPLAM",
        "KAR",
        "MARJ",
        "FD_GELIR",
        "FD_GIDER",
      ],
      maliyet_grubu: ["VIGO_WOOD", "HAS_MOB", "ORTAK"],
      odeme_durumu: ["TAMAMLANDI", "BEKLİYOR"],
      odeme_turu: [
        "PİYASA",
        "KREDİ",
        "KREDİ KARTI",
        "MAAŞ",
        "FAİZ",
        "SGK",
        "VERGİ",
        "HAMMADDE",
        "PERSONEL",
        "ELEKTRİK",
        "BANKA",
        "GENEL",
        "DİĞER",
      ],
      para_birimi: ["TL", "USD", "EUR"],
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

// ─── Custom Type Aliases ───
export type Odeme = Database["public"]["Tables"]["odemeler"]["Row"];
export type NakitDonem = Database["public"]["Tables"]["nakit_donemler"]["Row"];
export type NakitGiris = Database["public"]["Tables"]["nakit_girisler"]["Row"];
export type NakitCikis = Database["public"]["Tables"]["nakit_cikislar"]["Row"];
export type FaaliyetDonem = Database["public"]["Tables"]["faaliyet_donemler"]["Row"];
export type SatisGiris = Database["public"]["Tables"]["satis_giris"]["Row"];
export type MaliyetGiris = Database["public"]["Tables"]["maliyet_giris"]["Row"];
export type KarlilikData = Database["public"]["Tables"]["karlilik_data"]["Row"];

// ─── Enum Type Aliases ───
export type UserRole = Database["public"]["Enums"]["user_role"];
export type Station = Database["public"]["Enums"]["station"];
export type PartType = Database["public"]["Enums"]["part_type"];
export type ProductCategory = Database["public"]["Enums"]["product_category"];
