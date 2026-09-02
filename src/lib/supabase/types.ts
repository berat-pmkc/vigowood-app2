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
      agent_actions: {
        Row: {
          action_type: string
          agent_id: string
          cost_estimate: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json | null
          metadata: Json | null
          output: Json | null
          result: string
          task_id: string | null
          tokens_used: number | null
        }
        Insert: {
          action_type?: string
          agent_id: string
          cost_estimate?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          metadata?: Json | null
          output?: Json | null
          result?: string
          task_id?: string | null
          tokens_used?: number | null
        }
        Update: {
          action_type?: string
          agent_id?: string
          cost_estimate?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          metadata?: Json | null
          output?: Json | null
          result?: string
          task_id?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_chats: {
        Row: {
          agent_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_chats_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ops_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          agent_id: string
          confidence: number | null
          context: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key: string
          memory_type: string
          source: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          agent_id: string
          confidence?: number | null
          context?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key: string
          memory_type?: string
          source?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          agent_id?: string
          confidence?: number | null
          context?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key?: string
          memory_type?: string
          source?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          body: string
          created_at: string
          from_agent: string
          id: string
          message_type: string
          metadata: Json | null
          read_at: string | null
          status: string
          subject: string | null
          task_id: string | null
          to_agent: string
        }
        Insert: {
          body: string
          created_at?: string
          from_agent: string
          id?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          status?: string
          subject?: string | null
          task_id?: string | null
          to_agent: string
        }
        Update: {
          body?: string
          created_at?: string
          from_agent?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          status?: string
          subject?: string | null
          task_id?: string | null
          to_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agent_id: string
          created_at: string
          dedup_key: string | null
          id: string
          message: string | null
          metadata: Json | null
          monitor_id: string | null
          resolved_at: string | null
          severity: string
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          monitor_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id?: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          monitor_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitor_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      all_parts: {
        Row: {
          created_at: string
          hazir_eleman_aktif_stok: number
          birim_fiyat: number | null
          hazir_eleman_kritik_stok: number
          mdf_renk: string | null
          mdf_tipi: string | null
          part_adi: string
          part_id: string
          part_type: Database["public"]["Enums"]["part_type"]
          tur: string | null
          updated_at: string
          yari_mamul_stok: number
        }
        Insert: {
          created_at?: string
          hazir_eleman_aktif_stok?: number
          birim_fiyat?: number | null
          hazir_eleman_kritik_stok?: number
          mdf_renk?: string | null
          mdf_tipi?: string | null
          part_adi: string
          part_id: string
          part_type: Database["public"]["Enums"]["part_type"]
          tur?: string | null
          updated_at?: string
          yari_mamul_stok?: number
        }
        Update: {
          created_at?: string
          hazir_eleman_aktif_stok?: number
          birim_fiyat?: number | null
          hazir_eleman_kritik_stok?: number
          mdf_renk?: string | null
          mdf_tipi?: string | null
          part_adi?: string
          part_id?: string
          part_type?: Database["public"]["Enums"]["part_type"]
          tur?: string | null
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
      urun_maliyet_cache: {
        Row: {
          sku: string
          malzeme: number | null
          iscilik: number | null
          birim_maliyet: number | null
          eksik: boolean | null
          updated_at: string | null
        }
        Insert: {
          sku: string
          malzeme?: number | null
          iscilik?: number | null
          birim_maliyet?: number | null
          eksik?: boolean | null
          updated_at?: string | null
        }
        Update: {
          sku?: string
          malzeme?: number | null
          iscilik?: number | null
          birim_maliyet?: number | null
          eksik?: boolean | null
          updated_at?: string | null
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
      assistant_feedback: {
        Row: {
          agent_id: string
          comment: string | null
          comment_id: string | null
          created_at: string
          id: string
          promoted_to_rule: boolean
          rating: number | null
          task_id: string | null
        }
        Insert: {
          agent_id: string
          comment?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          promoted_to_rule?: boolean
          rating?: number | null
          task_id?: string | null
        }
        Update: {
          agent_id?: string
          comment?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          promoted_to_rule?: boolean
          rating?: number | null
          task_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          att_id: string
          created_at: string
          department: string | null
          durum: string
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
          durum?: string
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
          durum?: string
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
      daily_summary: {
        Row: {
          avg_basket: number
          channel: string
          created_at: string
          date: string
          refund_count: number
          status_distribution: Json | null
          top_cities: Json | null
          top_products: Json | null
          top_refunded_products: Json | null
          total_orders: number
          total_refunds: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          avg_basket?: number
          channel?: string
          created_at?: string
          date: string
          refund_count?: number
          status_distribution?: Json | null
          top_cities?: Json | null
          top_products?: Json | null
          top_refunded_products?: Json | null
          total_orders?: number
          total_refunds?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          avg_basket?: number
          channel?: string
          created_at?: string
          date?: string
          refund_count?: number
          status_distribution?: Json | null
          top_cities?: Json | null
          top_products?: Json | null
          top_refunded_products?: Json | null
          total_orders?: number
          total_refunds?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: []
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
      ikas_customers: {
        Row: {
          accepts_marketing: boolean | null
          city: string | null
          country: string | null
          created_at: string
          customer_segment: string | null
          email: string | null
          first_name: string | null
          first_order_date: string | null
          id: string
          ikas_customer_id: string
          ikas_synced_at: string | null
          last_name: string | null
          last_order_date: string | null
          order_count: number | null
          phone: string | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          accepts_marketing?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_segment?: string | null
          email?: string | null
          first_name?: string | null
          first_order_date?: string | null
          id?: string
          ikas_customer_id: string
          ikas_synced_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          order_count?: number | null
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          accepts_marketing?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_segment?: string | null
          email?: string | null
          first_name?: string | null
          first_order_date?: string | null
          id?: string
          ikas_customer_id?: string
          ikas_synced_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          order_count?: number | null
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ikas_orders: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          id: string
          ikas_created_at: string | null
          ikas_id: string
          line_items: Json | null
          order_number: string | null
          status: string | null
          synced_at: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          ikas_created_at?: string | null
          ikas_id: string
          line_items?: Json | null
          order_number?: string | null
          status?: string | null
          synced_at?: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          ikas_created_at?: string | null
          ikas_id?: string
          line_items?: Json | null
          order_number?: string | null
          status?: string | null
          synced_at?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ikas_products: {
        Row: {
          ikas_id: string
          name: string
          synced_at: string
          total_stock: number
          variants: Json | null
        }
        Insert: {
          ikas_id: string
          name: string
          synced_at?: string
          total_stock?: number
          variants?: Json | null
        }
        Update: {
          ikas_id?: string
          name?: string
          synced_at?: string
          total_stock?: number
          variants?: Json | null
        }
        Relationships: []
      }
      job_definitions: {
        Row: {
          agent_id: string
          config: Json | null
          created_at: string
          creates_task: boolean
          description: string | null
          fail_count: number
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          run_count: number
          schedule: string
          task_template: Json | null
          timezone: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          config?: Json | null
          created_at?: string
          creates_task?: boolean
          description?: string | null
          fail_count?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          run_count?: number
          schedule: string
          task_template?: Json | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          config?: Json | null
          created_at?: string
          creates_task?: boolean
          description?: string | null
          fail_count?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          run_count?: number
          schedule?: string
          task_template?: Json | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json | null
          job_id: string
          output: Json | null
          output_id: string | null
          started_at: string
          status: string
          task_id: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          job_id: string
          output?: Json | null
          output_id?: string | null
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          job_id?: string
          output?: Json | null
          output_id?: string | null
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "ops_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      kesim_talepleri: {
        Row: {
          created_at: string
          durum: string
          kesilen_adet: number
          oncelik: string
          plaka_id: string
          sku: string
          talep_adet: number
          talep_eden: string
          talep_id: string
          talep_notu: string | null
          tamamlanma_zamani: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          durum?: string
          kesilen_adet?: number
          oncelik?: string
          plaka_id: string
          sku: string
          talep_adet: number
          talep_eden: string
          talep_id: string
          talep_notu?: string | null
          tamamlanma_zamani?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          durum?: string
          kesilen_adet?: number
          oncelik?: string
          plaka_id?: string
          sku?: string
          talep_adet?: number
          talep_eden?: string
          talep_id?: string
          talep_notu?: string | null
          tamamlanma_zamani?: string | null
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
      makine_durum_log: {
        Row: {
          created_at: string
          degistiren: string | null
          durum: string
          id: string
          makine_id: string
          neden: string | null
        }
        Insert: {
          created_at?: string
          degistiren?: string | null
          durum: string
          id?: string
          makine_id: string
          neden?: string | null
        }
        Update: {
          created_at?: string
          degistiren?: string | null
          durum?: string
          id?: string
          makine_id?: string
          neden?: string | null
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
      marketplace_listings: {
        Row: {
          aktif: boolean
          barkod: string | null
          created_at: string | null
          ham_fiyat: number
          hedef_fiyat_kullanilan: number
          id: string
          kar_marji: number
          kargo_maliyeti: number
          komisyon_orani: number
          listing_kodu: string
          marketplace_id: string
          oneri_fiyat: number
          ozel_maliyetler: Json | null
          reklam_orani: number
          satis_fiyati: number
          shipping_provider_id: string | null
          sku: string
          updated_at: string | null
          urun_adi: string | null
        }
        Insert: {
          aktif?: boolean
          barkod?: string | null
          created_at?: string | null
          ham_fiyat?: number
          hedef_fiyat_kullanilan?: number
          id?: string
          kar_marji?: number
          kargo_maliyeti?: number
          komisyon_orani?: number
          listing_kodu: string
          marketplace_id: string
          oneri_fiyat?: number
          ozel_maliyetler?: Json | null
          reklam_orani?: number
          satis_fiyati?: number
          shipping_provider_id?: string | null
          sku: string
          updated_at?: string | null
          urun_adi?: string | null
        }
        Update: {
          aktif?: boolean
          barkod?: string | null
          created_at?: string | null
          ham_fiyat?: number
          hedef_fiyat_kullanilan?: number
          id?: string
          kar_marji?: number
          kargo_maliyeti?: number
          komisyon_orani?: number
          listing_kodu?: string
          marketplace_id?: string
          oneri_fiyat?: number
          ozel_maliyetler?: Json | null
          reklam_orani?: number
          satis_fiyati?: number
          shipping_provider_id?: string | null
          sku?: string
          updated_at?: string | null
          urun_adi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      marketplace_shipping: {
        Row: {
          created_at: string | null
          id: string
          marketplace_id: string
          shipping_provider_id: string
          varsayilan: boolean
        }
        Insert: {
          created_at?: string | null
          id?: string
          marketplace_id: string
          shipping_provider_id: string
          varsayilan?: boolean
        }
        Update: {
          created_at?: string | null
          id?: string
          marketplace_id?: string
          shipping_provider_id?: string
          varsayilan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_shipping_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_shipping_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplaces: {
        Row: {
          aktif: boolean
          code: string
          created_at: string | null
          hedef_fiyat_tipi: string
          id: string
          name: string
          ozel_ayarlar: Json | null
          sira: number
          stopaj_orani: number
          updated_at: string | null
          vergi_dahil: boolean
        }
        Insert: {
          aktif?: boolean
          code: string
          created_at?: string | null
          hedef_fiyat_tipi?: string
          id?: string
          name: string
          ozel_ayarlar?: Json | null
          sira?: number
          stopaj_orani?: number
          updated_at?: string | null
          vergi_dahil?: boolean
        }
        Update: {
          aktif?: boolean
          code?: string
          created_at?: string | null
          hedef_fiyat_tipi?: string
          id?: string
          name?: string
          ozel_ayarlar?: Json | null
          sira?: number
          stopaj_orani?: number
          updated_at?: string | null
          vergi_dahil?: boolean
        }
        Relationships: []
      }
      monitor_definitions: {
        Row: {
          agent_id: string
          cooldown_minutes: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          monitor_type: string
          name: string
          on_trigger: Json | null
          query_config: Json
          severity: string
          threshold_rule: Json | null
          trigger_count: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          monitor_type?: string
          name: string
          on_trigger?: Json | null
          query_config?: Json
          severity?: string
          threshold_rule?: Json | null
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          monitor_type?: string
          name?: string
          on_trigger?: Json | null
          query_config?: Json
          severity?: string
          threshold_rule?: Json | null
          trigger_count?: number
          updated_at?: string
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
      montaj_sessions: {
        Row: {
          birim_montaj_dk: number | null
          brut_sure_dk: number | null
          mola_dk: number | null
          net_sure_dk: number | null
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
          brut_sure_dk?: number | null
          mola_dk?: number | null
          net_sure_dk?: number | null
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
          brut_sure_dk?: number | null
          mola_dk?: number | null
          net_sure_dk?: number | null
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
      monthly_sku_summary: {
        Row: {
          avg_price: number
          channel: string
          created_at: string
          master_sku: string | null
          month_start: string
          product_name: string
          quantity_sold: number
          refund_count: number
          revenue: number
          sku: string
          updated_at: string
        }
        Insert: {
          avg_price?: number
          channel?: string
          created_at?: string
          master_sku?: string | null
          month_start: string
          product_name?: string
          quantity_sold?: number
          refund_count?: number
          revenue?: number
          sku: string
          updated_at?: string
        }
        Update: {
          avg_price?: number
          channel?: string
          created_at?: string
          master_sku?: string | null
          month_start?: string
          product_name?: string
          quantity_sold?: number
          refund_count?: number
          revenue?: number
          sku?: string
          updated_at?: string
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
      ops_agents: {
        Row: {
          avatar_url: string | null
          capabilities: Json | null
          code: string
          created_at: string
          department: string
          description: string | null
          id: string
          is_active: boolean
          last_active_at: string | null
          name: string
          role: string
          schedule: Json | null
          stats: Json | null
          status: Database["public"]["Enums"]["agent_status"]
          total_approvals_requested: number
          total_outputs_generated: number
          total_tasks_completed: number
          updated_at: string
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          capabilities?: Json | null
          code: string
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          name: string
          role?: string
          schedule?: Json | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["agent_status"]
          total_approvals_requested?: number
          total_outputs_generated?: number
          total_tasks_completed?: number
          updated_at?: string
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          capabilities?: Json | null
          code?: string
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          name?: string
          role?: string
          schedule?: Json | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["agent_status"]
          total_approvals_requested?: number
          total_outputs_generated?: number
          total_tasks_completed?: number
          updated_at?: string
          working_hours?: Json | null
        }
        Relationships: []
      }
      ops_approvals: {
        Row: {
          action_type: Database["public"]["Enums"]["approval_action_type"]
          agent_id: string | null
          created_at: string
          description: string | null
          id: string
          old_payload: Json | null
          payload: Json | null
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          risk_level: Database["public"]["Enums"]["approval_risk_level"]
          status: Database["public"]["Enums"]["approval_status"]
          task_id: string | null
          title: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["approval_action_type"]
          agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          old_payload?: Json | null
          payload?: Json | null
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_level?: Database["public"]["Enums"]["approval_risk_level"]
          status?: Database["public"]["Enums"]["approval_status"]
          task_id?: string | null
          title: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["approval_action_type"]
          agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          old_payload?: Json | null
          payload?: Json | null
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_level?: Database["public"]["Enums"]["approval_risk_level"]
          status?: Database["public"]["Enums"]["approval_status"]
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ops_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_outputs: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: Database["public"]["Enums"]["output_file_type"]
          file_url: string
          id: string
          metadata: Json | null
          task_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: Database["public"]["Enums"]["output_file_type"]
          file_url: string
          id?: string
          metadata?: Json | null
          task_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: Database["public"]["Enums"]["output_file_type"]
          file_url?: string
          id?: string
          metadata?: Json | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_outputs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ops_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_outputs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_events: {
        Row: {
          birim_paketleme_dk: number | null
          created_at: string
          depo_id: string | null
          duraklama_dk: number
          duraklatma_baslangic: string | null
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
          depo_id?: string | null
          duraklama_dk?: number
          duraklatma_baslangic?: string | null
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
          depo_id?: string | null
          duraklama_dk?: number
          duraklatma_baslangic?: string | null
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
          boy: number | null
          created_at: string
          en: number | null
          kesim_sureleri: Json | null
          plaka_adi: string | null
          plaka_id: string
          plaka_kategori: string
          plakalar_id: string
          renk: string | null
          sku: string[] | null
          tipi: string | null
          updated_at: string | null
        }
        Insert: {
          boy?: number | null
          created_at?: string
          en?: number | null
          kesim_sureleri?: Json | null
          plaka_adi?: string | null
          plaka_id: string
          plaka_kategori?: string
          plakalar_id: string
          renk?: string | null
          sku?: string[] | null
          tipi?: string | null
          updated_at?: string | null
        }
        Update: {
          boy?: number | null
          created_at?: string
          en?: number | null
          kesim_sureleri?: Json | null
          plaka_adi?: string | null
          plaka_id?: string
          plaka_kategori?: string
          plakalar_id?: string
          renk?: string | null
          sku?: string[] | null
          tipi?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          donem_kodu: string
          ham_fiyat: number | null
          hedef_fiyat: number | null
          id: string
          kar_marji: number | null
          kargo_maliyeti: number | null
          komisyon_orani: number | null
          listing_kodu: string
          marketplace_id: string
          reklam_orani: number | null
          satis_fiyati: number | null
          sku: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          donem_kodu: string
          ham_fiyat?: number | null
          hedef_fiyat?: number | null
          id?: string
          kar_marji?: number | null
          kargo_maliyeti?: number | null
          komisyon_orani?: number | null
          listing_kodu: string
          marketplace_id: string
          reklam_orani?: number | null
          satis_fiyati?: number | null
          sku: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          donem_kodu?: string
          ham_fiyat?: number | null
          hedef_fiyat?: number | null
          id?: string
          kar_marji?: number | null
          kargo_maliyeti?: number | null
          komisyon_orani?: number | null
          listing_kodu?: string
          marketplace_id?: string
          reklam_orani?: number | null
          satis_fiyati?: number | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pricing_snapshots_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_snapshots_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      product_box_dimensions: {
        Row: {
          boy_cm: number
          created_at: string | null
          desi: number
          en_cm: number
          id: string
          sku: string
          updated_at: string | null
          yukseklik_cm: number
        }
        Insert: {
          boy_cm?: number
          created_at?: string | null
          desi?: number
          en_cm?: number
          id?: string
          sku: string
          updated_at?: string | null
          yukseklik_cm?: number
        }
        Update: {
          boy_cm?: number
          created_at?: string | null
          desi?: number
          en_cm?: number
          id?: string
          sku?: string
          updated_at?: string | null
          yukseklik_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_box_dimensions_sku_fkey"
            columns: ["sku"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      product_target_prices: {
        Row: {
          aktif: boolean
          created_at: string | null
          gecerlilik_baslangic: string | null
          hedef_fiyat: number
          hedef_fiyat_kdv: number
          id: string
          sku: string
          toptan_hedef_fiyat: number
          toptan_hedef_fiyat_kdv: number
          updated_at: string | null
        }
        Insert: {
          aktif?: boolean
          created_at?: string | null
          gecerlilik_baslangic?: string | null
          hedef_fiyat?: number
          hedef_fiyat_kdv?: number
          id?: string
          sku: string
          toptan_hedef_fiyat?: number
          toptan_hedef_fiyat_kdv?: number
          updated_at?: string | null
        }
        Update: {
          aktif?: boolean
          created_at?: string | null
          gecerlilik_baslangic?: string | null
          hedef_fiyat?: number
          hedef_fiyat_kdv?: number
          id?: string
          sku?: string
          toptan_hedef_fiyat?: number
          toptan_hedef_fiyat_kdv?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_target_prices_sku_fkey"
            columns: ["sku"]
            isOneToOne: true
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
          desi: number | null
          gecen_ay_uretim: number
          gunluk_satis: number
          ilk_satis_tarihi: string | null
          koli_adedi: number | null
          kategori: Database["public"]["Enums"]["product_category"] | null
          kutu_agirlik_kg: number | null
          kutu_boy_cm: number | null
          kutu_en_cm: number | null
          kutu_yukseklik_cm: number | null
          mamul_stok_kritik: number
          renk_kodu: string | null
          satilan_gun_sayisi: number
          sku: string
          stok_aktif: number
          toplam_satis: number
          updated_at: string
          urun_adi: string | null
          urun_grubu: string | null
          urun_agirlik_kg: number | null
        }
        Insert: {
          aktif_mi?: boolean
          aylik_uretim?: number
          created_at?: string
          desi?: number | null
          gecen_ay_uretim?: number
          gunluk_satis?: number
          ilk_satis_tarihi?: string | null
          koli_adedi?: number | null
          kategori?: Database["public"]["Enums"]["product_category"] | null
          kutu_agirlik_kg?: number | null
          kutu_boy_cm?: number | null
          kutu_en_cm?: number | null
          kutu_yukseklik_cm?: number | null
          mamul_stok_kritik?: number
          renk_kodu?: string | null
          satilan_gun_sayisi?: number
          sku: string
          stok_aktif?: number
          toplam_satis?: number
          updated_at?: string
          urun_adi?: string | null
          urun_grubu?: string | null
          urun_agirlik_kg?: number | null
        }
        Update: {
          aktif_mi?: boolean
          aylik_uretim?: number
          created_at?: string
          desi?: number | null
          gecen_ay_uretim?: number
          gunluk_satis?: number
          ilk_satis_tarihi?: string | null
          koli_adedi?: number | null
          kategori?: Database["public"]["Enums"]["product_category"] | null
          kutu_agirlik_kg?: number | null
          kutu_boy_cm?: number | null
          kutu_en_cm?: number | null
          kutu_yukseklik_cm?: number | null
          mamul_stok_kritik?: number
          renk_kodu?: string | null
          satilan_gun_sayisi?: number
          sku?: string
          stok_aktif?: number
          toplam_satis?: number
          updated_at?: string
          urun_adi?: string | null
          urun_grubu?: string | null
          urun_agirlik_kg?: number | null
        }
        Relationships: []
      }
      recurring_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          cron_schedule: string
          department: Database["public"]["Enums"]["task_department"] | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          run_count: number | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cron_schedule?: string
          department?: Database["public"]["Enums"]["task_department"] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          run_count?: number | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cron_schedule?: string
          department?: Database["public"]["Enums"]["task_department"] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          run_count?: number | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recurring_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
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
      resmi_tatiller: {
        Row: {
          aktif: boolean
          ad: string
          created_at: string
          hedeften_dus: boolean
          tarih: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          ad: string
          created_at?: string
          hedeften_dus?: boolean
          tarih: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          ad?: string
          created_at?: string
          hedeften_dus?: boolean
          tarih?: string
          updated_at?: string
        }
        Relationships: []
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
      shipping_providers: {
        Row: {
          aktif: boolean
          code: string
          created_at: string | null
          desi_fiyatlari: Json
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          aktif?: boolean
          code: string
          created_at?: string | null
          desi_fiyatlari?: Json
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          aktif?: boolean
          code?: string
          created_at?: string | null
          desi_fiyatlari?: Json
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          desi_fiyatlari: Json
          donem_kodu: string
          id: string
          provider_code: string
          provider_name: string
          shipping_provider_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          desi_fiyatlari?: Json
          donem_kodu: string
          id?: string
          provider_code: string
          provider_name: string
          shipping_provider_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          desi_fiyatlari?: Json
          donem_kodu?: string
          id?: string
          provider_code?: string
          provider_name?: string
          shipping_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_snapshots_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_mappings: {
        Row: {
          channel: string
          channel_barcode: string | null
          channel_product_code: string | null
          channel_product_id: string | null
          channel_product_name: string | null
          channel_sku: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          master_sku: string
          match_method: string | null
          match_status: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          channel_barcode?: string | null
          channel_product_code?: string | null
          channel_product_id?: string | null
          channel_product_name?: string | null
          channel_sku?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          master_sku: string
          match_method?: string | null
          match_status?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          channel_barcode?: string | null
          channel_product_code?: string | null
          channel_product_id?: string | null
          channel_product_name?: string | null
          channel_sku?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          master_sku?: string
          match_method?: string | null
          match_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stok_sayimlari: {
        Row: {
          ad: string
          created_at: string
          durum: string
          kapsam: string[]
          notlar: string | null
          olusturan: string | null
          sayim_id: string
          sayim_tarihi: string
          tamamlanma_zamani: string | null
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          durum?: string
          kapsam?: string[]
          notlar?: string | null
          olusturan?: string | null
          sayim_id: string
          sayim_tarihi?: string
          tamamlanma_zamani?: string | null
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          durum?: string
          kapsam?: string[]
          notlar?: string | null
          olusturan?: string | null
          sayim_id?: string
          sayim_tarihi?: string
          tamamlanma_zamani?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stok_sayim_satirlari: {
        Row: {
          created_at: string
          fark: number | null
          id: string
          kalem_adi: string | null
          kalem_id: string
          kalem_tipi: string
          kategori: string
          not_text: string | null
          sayilan_miktar: number | null
          sayim_id: string
          sistem_miktar: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kalem_adi?: string | null
          kalem_id: string
          kalem_tipi: string
          kategori: string
          not_text?: string | null
          sayilan_miktar?: number | null
          sayim_id: string
          sistem_miktar?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kalem_adi?: string | null
          kalem_id?: string
          kalem_tipi?: string
          kategori?: string
          not_text?: string | null
          sayilan_miktar?: number | null
          sayim_id?: string
          sistem_miktar?: number
          updated_at?: string
        }
        Relationships: []
      }
      depolar: {
        Row: {
          aciklama: string | null
          ad: string
          aktif: boolean
          created_at: string
          depo_id: string
          sira: number
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          aktif?: boolean
          created_at?: string
          depo_id: string
          sira?: number
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          aktif?: boolean
          created_at?: string
          depo_id?: string
          sira?: number
          updated_at?: string
        }
        Relationships: []
      }
      kutu_sablonlari: {
        Row: {
          ad: string
          aktif: boolean
          alan_m2: number | null
          created_at: string
          fefco_kodu: string
          hesaplanan_boy: number | null
          hesaplanan_en: number | null
          ic_genislik: number
          ic_uzunluk: number
          ic_yukseklik: number
          notlar: string | null
          oluk_tipi: string | null
          olusturan: string | null
          part_id: string | null
          sablon_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          alan_m2?: number | null
          created_at?: string
          fefco_kodu?: string
          hesaplanan_boy?: number | null
          hesaplanan_en?: number | null
          ic_genislik: number
          ic_uzunluk: number
          ic_yukseklik: number
          notlar?: string | null
          oluk_tipi?: string | null
          olusturan?: string | null
          part_id?: string | null
          sablon_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          alan_m2?: number | null
          created_at?: string
          fefco_kodu?: string
          hesaplanan_boy?: number | null
          hesaplanan_en?: number | null
          ic_genislik?: number
          ic_uzunluk?: number
          ic_yukseklik?: number
          notlar?: string | null
          oluk_tipi?: string | null
          olusturan?: string | null
          part_id?: string | null
          sablon_id?: string
          sku?: string | null
          updated_at?: string
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
          depo_id: string | null
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
          depo_id?: string | null
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
          depo_id?: string | null
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
      task_activity: {
        Row: {
          action: Database["public"]["Enums"]["task_activity_action"]
          actor_id: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["task_activity_action"]
          actor_id: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["task_activity_action"]
          actor_id?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          role: string | null
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          role?: string | null
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_runs: {
        Row: {
          completed_at: string | null
          id: string
          recurring_task_id: string
          run_code: string | null
          run_number: number
          started_at: string | null
          status: string | null
          task_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          recurring_task_id: string
          run_code?: string | null
          run_number?: number
          started_at?: string | null
          status?: string | null
          task_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          recurring_task_id?: string
          run_code?: string | null
          run_number?: number
          started_at?: string | null
          status?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_runs_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          assignee_id: string | null
          checklist: Json | null
          created_at: string | null
          created_by: string | null
          department: Database["public"]["Enums"]["task_department"] | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department?: Database["public"]["Enums"]["task_department"] | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          department?: Database["public"]["Enums"]["task_department"] | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          department: Database["public"]["Enums"]["task_department"]
          description: string | null
          due_date: string | null
          id: string
          is_blocked: boolean | null
          is_waiting_approval: boolean | null
          parent_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          source: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["task_source_type"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          department?: Database["public"]["Enums"]["task_department"]
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean | null
          is_waiting_approval?: boolean | null
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          source?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["task_source_type"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          department?: Database["public"]["Enums"]["task_department"]
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean | null
          is_waiting_approval?: boolean | null
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          source?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["task_source_type"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      trendyol_ad_sku_mappings: {
        Row: {
          ad_name: string
          id: string
          product_ids: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ad_name: string
          id?: string
          product_ids?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ad_name?: string
          id?: string
          product_ids?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      trendyol_ad_snapshots: {
        Row: {
          actual_cpc: number | null
          ad_name: string
          clicks: number | null
          content_ids: string | null
          cpc_bid: string | null
          created_at: string | null
          cumulative_roas: number | null
          daily_budget: number | null
          direct_revenue: number | null
          direct_sales: number | null
          end_date: string | null
          id: string
          impressions: number | null
          indirect_revenue: number | null
          indirect_sales: number | null
          product_count: number | null
          remaining_budget: number | null
          snapshot_date: string
          spent: number | null
          start_date: string | null
          status: string | null
          total_budget: number | null
          total_revenue: number | null
          total_sales: number | null
          uploaded_by: string | null
        }
        Insert: {
          actual_cpc?: number | null
          ad_name: string
          clicks?: number | null
          content_ids?: string | null
          cpc_bid?: string | null
          created_at?: string | null
          cumulative_roas?: number | null
          daily_budget?: number | null
          direct_revenue?: number | null
          direct_sales?: number | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          indirect_revenue?: number | null
          indirect_sales?: number | null
          product_count?: number | null
          remaining_budget?: number | null
          snapshot_date: string
          spent?: number | null
          start_date?: string | null
          status?: string | null
          total_budget?: number | null
          total_revenue?: number | null
          total_sales?: number | null
          uploaded_by?: string | null
        }
        Update: {
          actual_cpc?: number | null
          ad_name?: string
          clicks?: number | null
          content_ids?: string | null
          cpc_bid?: string | null
          created_at?: string | null
          cumulative_roas?: number | null
          daily_budget?: number | null
          direct_revenue?: number | null
          direct_sales?: number | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          indirect_revenue?: number | null
          indirect_sales?: number | null
          product_count?: number | null
          remaining_budget?: number | null
          snapshot_date?: string
          spent?: number | null
          start_date?: string | null
          status?: string | null
          total_budget?: number | null
          total_revenue?: number | null
          total_sales?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      trendyol_ad_weekly: {
        Row: {
          actual_cpc: number | null
          ad_name: string
          clicks: number | null
          cpa: number | null
          created_at: string | null
          ctr: number | null
          cvr: number | null
          days_in_period: number | null
          direct_revenue: number | null
          direct_sales: number | null
          id: string
          impressions: number | null
          indirect_revenue: number | null
          indirect_sales: number | null
          period_end: string
          period_start: string
          roas: number | null
          spent: number | null
          total_revenue: number | null
          total_sales: number | null
        }
        Insert: {
          actual_cpc?: number | null
          ad_name: string
          clicks?: number | null
          cpa?: number | null
          created_at?: string | null
          ctr?: number | null
          cvr?: number | null
          days_in_period?: number | null
          direct_revenue?: number | null
          direct_sales?: number | null
          id?: string
          impressions?: number | null
          indirect_revenue?: number | null
          indirect_sales?: number | null
          period_end: string
          period_start: string
          roas?: number | null
          spent?: number | null
          total_revenue?: number | null
          total_sales?: number | null
        }
        Update: {
          actual_cpc?: number | null
          ad_name?: string
          clicks?: number | null
          cpa?: number | null
          created_at?: string | null
          ctr?: number | null
          cvr?: number | null
          days_in_period?: number | null
          direct_revenue?: number | null
          direct_sales?: number | null
          id?: string
          impressions?: number | null
          indirect_revenue?: number | null
          indirect_sales?: number | null
          period_end?: string
          period_start?: string
          roas?: number | null
          spent?: number | null
          total_revenue?: number | null
          total_sales?: number | null
        }
        Relationships: []
      }
      trendyol_claims: {
        Row: {
          cargo_tracking_number: string | null
          claim_date: number
          created_at: string
          id: string
          items: Json
          order_number: string
          shipment_package_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          cargo_tracking_number?: string | null
          claim_date: number
          created_at?: string
          id: string
          items?: Json
          order_number: string
          shipment_package_id?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          cargo_tracking_number?: string | null
          claim_date?: number
          created_at?: string
          id?: string
          items?: Json
          order_number?: string
          shipment_package_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      trendyol_order_lines: {
        Row: {
          amount: number | null
          barcode: string | null
          commission: number | null
          commission_amount: number | null
          currency_code: string | null
          discount: number | null
          id: number
          image_url: string | null
          line_id: number | null
          merchant_sku: string | null
          order_id: number
          price: number | null
          product_color: string | null
          product_name: string
          product_size: string | null
          quantity: number | null
          sku: string | null
          status_name: string | null
          stock_code: string | null
          vat_base_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number | null
          barcode?: string | null
          commission?: number | null
          commission_amount?: number | null
          currency_code?: string | null
          discount?: number | null
          id: number
          image_url?: string | null
          line_id?: number | null
          merchant_sku?: string | null
          order_id: number
          price?: number | null
          product_color?: string | null
          product_name: string
          product_size?: string | null
          quantity?: number | null
          sku?: string | null
          status_name?: string | null
          stock_code?: string | null
          vat_base_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number | null
          barcode?: string | null
          commission?: number | null
          commission_amount?: number | null
          currency_code?: string | null
          discount?: number | null
          id?: number
          image_url?: string | null
          line_id?: number | null
          merchant_sku?: string | null
          order_id?: number
          price?: number | null
          product_color?: string | null
          product_name?: string
          product_size?: string | null
          quantity?: number | null
          sku?: string | null
          status_name?: string | null
          stock_code?: string | null
          vat_base_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trendyol_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "trendyol_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trendyol_orders: {
        Row: {
          cargo_provider_name: string | null
          cargo_sender_number: string | null
          cargo_tracking_link: string | null
          cargo_tracking_number: number | null
          created_at: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_id: number | null
          customer_last_name: string | null
          delivery_type: string | null
          gross_amount: number | null
          id: number
          invoice_address: Json | null
          last_modified_date: number | null
          order_date: number
          order_number: string
          package_histories: Json | null
          raw_data: Json | null
          shipment_address: Json | null
          status: string
          total_discount: number | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          cargo_provider_name?: string | null
          cargo_sender_number?: string | null
          cargo_tracking_link?: string | null
          cargo_tracking_number?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          delivery_type?: string | null
          gross_amount?: number | null
          id: number
          invoice_address?: Json | null
          last_modified_date?: number | null
          order_date: number
          order_number: string
          package_histories?: Json | null
          raw_data?: Json | null
          shipment_address?: Json | null
          status?: string
          total_discount?: number | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          cargo_provider_name?: string | null
          cargo_sender_number?: string | null
          cargo_tracking_link?: string | null
          cargo_tracking_number?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          delivery_type?: string | null
          gross_amount?: number | null
          id?: number
          invoice_address?: Json | null
          last_modified_date?: number | null
          order_date?: number
          order_number?: string
          package_histories?: Json | null
          raw_data?: Json | null
          shipment_address?: Json | null
          status?: string
          total_discount?: number | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trendyol_other_financials: {
        Row: {
          created_at: string | null
          credit: number | null
          debt: number | null
          description: string | null
          id: string
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          credit?: number | null
          debt?: number | null
          description?: string | null
          id: string
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          credit?: number | null
          debt?: number | null
          description?: string | null
          id?: string
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      trendyol_products: {
        Row: {
          approved: boolean | null
          archived: boolean | null
          attributes: Json | null
          barcode: string
          blacklisted: boolean | null
          brand: string | null
          brand_id: number | null
          category_id: number | null
          category_name: string | null
          create_date_time: number | null
          created_at: string | null
          description: string | null
          dimensional_weight: number | null
          id: string
          images: Json | null
          last_update_date: number | null
          list_price: number | null
          locked: boolean | null
          on_sale: boolean | null
          product_main_id: string | null
          quantity: number | null
          raw_data: Json | null
          rejected: boolean | null
          sale_price: number | null
          stock_code: string | null
          title: string
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          approved?: boolean | null
          archived?: boolean | null
          attributes?: Json | null
          barcode: string
          blacklisted?: boolean | null
          brand?: string | null
          brand_id?: number | null
          category_id?: number | null
          category_name?: string | null
          create_date_time?: number | null
          created_at?: string | null
          description?: string | null
          dimensional_weight?: number | null
          id: string
          images?: Json | null
          last_update_date?: number | null
          list_price?: number | null
          locked?: boolean | null
          on_sale?: boolean | null
          product_main_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          rejected?: boolean | null
          sale_price?: number | null
          stock_code?: string | null
          title: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          approved?: boolean | null
          archived?: boolean | null
          attributes?: Json | null
          barcode?: string
          blacklisted?: boolean | null
          brand?: string | null
          brand_id?: number | null
          category_id?: number | null
          category_name?: string | null
          create_date_time?: number | null
          created_at?: string | null
          description?: string | null
          dimensional_weight?: number | null
          id?: string
          images?: Json | null
          last_update_date?: number | null
          list_price?: number | null
          locked?: boolean | null
          on_sale?: boolean | null
          product_main_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          rejected?: boolean | null
          sale_price?: number | null
          stock_code?: string | null
          title?: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      trendyol_questions: {
        Row: {
          answer_date: number | null
          answer_text: string | null
          created_at: string | null
          creation_date: number
          customer_id: number | null
          id: number
          image_url: string | null
          product_main_id: string | null
          product_name: string | null
          public: boolean | null
          raw_data: Json | null
          rejected_answer_reason: string | null
          rejected_answer_text: string | null
          status: string
          text: string
          updated_at: string | null
          user_name: string | null
          web_url: string | null
        }
        Insert: {
          answer_date?: number | null
          answer_text?: string | null
          created_at?: string | null
          creation_date: number
          customer_id?: number | null
          id: number
          image_url?: string | null
          product_main_id?: string | null
          product_name?: string | null
          public?: boolean | null
          raw_data?: Json | null
          rejected_answer_reason?: string | null
          rejected_answer_text?: string | null
          status?: string
          text: string
          updated_at?: string | null
          user_name?: string | null
          web_url?: string | null
        }
        Update: {
          answer_date?: number | null
          answer_text?: string | null
          created_at?: string | null
          creation_date?: number
          customer_id?: number | null
          id?: number
          image_url?: string | null
          product_main_id?: string | null
          product_name?: string | null
          public?: boolean | null
          raw_data?: Json | null
          rejected_answer_reason?: string | null
          rejected_answer_text?: string | null
          status?: string
          text?: string
          updated_at?: string | null
          user_name?: string | null
          web_url?: string | null
        }
        Relationships: []
      }
      trendyol_settlements: {
        Row: {
          affiliate: string | null
          barcode: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          credit: number | null
          debt: number | null
          id: number
          order_number: string | null
          payment_date: string | null
          payment_order_id: string | null
          raw_data: Json | null
          receipt_id: string | null
          seller_revenue: number | null
          shipment_package_id: number | null
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          affiliate?: string | null
          barcode?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          credit?: number | null
          debt?: number | null
          id: number
          order_number?: string | null
          payment_date?: string | null
          payment_order_id?: string | null
          raw_data?: Json | null
          receipt_id?: string | null
          seller_revenue?: number | null
          shipment_package_id?: number | null
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          affiliate?: string | null
          barcode?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          credit?: number | null
          debt?: number | null
          id?: number
          order_number?: string | null
          payment_date?: string | null
          payment_order_id?: string | null
          raw_data?: Json | null
          receipt_id?: string | null
          seller_revenue?: number | null
          shipment_package_id?: number | null
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      trendyol_sync_log: {
        Row: {
          completed_at: string | null
          entity_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          records_synced: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      mola_planlari: {
        Row: {
          aciklama: string | null
          ad: string
          aktif: boolean
          araliklar: Json
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          aktif?: boolean
          araliklar?: Json
          created_at?: string
          id?: number
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          aktif?: boolean
          araliklar?: Json
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      uretim_uyarilari: {
        Row: {
          adet: number
          baslik: string
          created_at: string
          dedup_key: string
          detay: Json
          durum: string
          hedef_user: string | null
          id: string
          tarih: string
          tur: string
          updated_at: string
        }
        Insert: {
          adet?: number
          baslik: string
          created_at?: string
          dedup_key: string
          detay?: Json
          durum?: string
          hedef_user?: string | null
          id?: string
          tarih: string
          tur: string
          updated_at?: string
        }
        Update: {
          adet?: number
          baslik?: string
          created_at?: string
          dedup_key?: string
          detay?: Json
          durum?: string
          hedef_user?: string | null
          id?: string
          tarih?: string
          tur?: string
          updated_at?: string
        }
        Relationships: []
      }
      yukleme_planlari: {
        Row: {
          ad: string
          created_at: string
          doluluk_yuzde: number | null
          durum: string
          girdi: Json
          ic_genislik: number
          ic_uzunluk: number
          ic_yukseklik: number
          id: string
          konteyner_tipi: string
          kullanilan_boy: number | null
          olusturan: string | null
          sevkiyat_id: string | null
          sonuc: Json
          toplam_agirlik: number | null
          toplam_hacim: number | null
          toplam_koli: number | null
          updated_at: string
        }
        Insert: {
          ad: string
          created_at?: string
          doluluk_yuzde?: number | null
          durum?: string
          girdi?: Json
          ic_genislik: number
          ic_uzunluk: number
          ic_yukseklik: number
          id?: string
          konteyner_tipi: string
          kullanilan_boy?: number | null
          olusturan?: string | null
          sevkiyat_id?: string | null
          sonuc?: Json
          toplam_agirlik?: number | null
          toplam_hacim?: number | null
          toplam_koli?: number | null
          updated_at?: string
        }
        Update: {
          ad?: string
          created_at?: string
          doluluk_yuzde?: number | null
          durum?: string
          girdi?: Json
          ic_genislik?: number
          ic_uzunluk?: number
          ic_yukseklik?: number
          id?: string
          konteyner_tipi?: string
          kullanilan_boy?: number | null
          olusturan?: string | null
          sevkiyat_id?: string | null
          sonuc?: Json
          toplam_agirlik?: number | null
          toplam_hacim?: number | null
          toplam_koli?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          allowed_modules: string[] | null
          auth_id: string | null
          avatar_url: string | null
          can_be_ops_assignee: boolean
          created_at: string
          email: string | null
          full_name: string
          mola_plani_id: number | null
          uretim_seansi_beklenir: boolean
          is_active: boolean
          password_plain: string | null
          role: Database["public"]["Enums"]["user_role"]
          station: Database["public"]["Enums"]["station"]
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_modules?: string[] | null
          auth_id?: string | null
          avatar_url?: string | null
          can_be_ops_assignee?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          mola_plani_id?: number | null
          uretim_seansi_beklenir?: boolean
          is_active?: boolean
          password_plain?: string | null
          role: Database["public"]["Enums"]["user_role"]
          station: Database["public"]["Enums"]["station"]
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_modules?: string[] | null
          auth_id?: string | null
          avatar_url?: string | null
          can_be_ops_assignee?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          mola_plani_id?: number | null
          uretim_seansi_beklenir?: boolean
          is_active?: boolean
          password_plain?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          station?: Database["public"]["Enums"]["station"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_sku_summary: {
        Row: {
          avg_price: number
          channel: string
          created_at: string
          master_sku: string | null
          product_name: string
          quantity_sold: number
          refund_count: number
          revenue: number
          sku: string
          updated_at: string
          week_start: string
        }
        Insert: {
          avg_price?: number
          channel?: string
          created_at?: string
          master_sku?: string | null
          product_name?: string
          quantity_sold?: number
          refund_count?: number
          revenue?: number
          sku: string
          updated_at?: string
          week_start: string
        }
        Update: {
          avg_price?: number
          channel?: string
          created_at?: string
          master_sku?: string | null
          product_name?: string
          quantity_sold?: number
          refund_count?: number
          revenue?: number
          sku?: string
          updated_at?: string
          week_start?: string
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
      kutu_aylik_tuketim: {
        Row: {
          adet: number | null
          ay: string | null
          fefco_kodu: string | null
          part_adi: string | null
          part_id: string | null
          sablon_adi: string | null
          sablon_id: string | null
          seans: number | null
          toplam_m2: number | null
        }
        Relationships: []
      }

      urun_depo_stok: {
        Row: {
          depo_adi: string | null
          depo_id: string | null
          depo_sira: number | null
          miktar: number | null
          sku: string | null
          son_hareket: string | null
        }
        Relationships: []
      }
      urun_toplam_stok: {
        Row: {
          miktar: number | null
          sku: string | null
          son_hareket: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_urun_maliyet_cache: {
        Args: Record<string, never>
        Returns: undefined
      }
      sevkiyat_sil: {
        Args: { p_sevkiyat_id: string }
        Returns: { silinen_kalem: number; kopan_plan: number }[]
      }
      montaj_seansi_sil: {
        Args: { p_session_id: string }
        Returns: { silinen_hareket: number; geri_alinan_parca: number }[]
      }
      paketleme_seansi_sil: {
        Args: { p_session_id: string }
        Returns: { silinen_hareket: number; geri_alinan_adet: number }[]
      }
      depo_transfer: {
        Args: { p_sku: string; p_kaynak: string; p_hedef: string; p_miktar: number; p_not?: string | null }
        Returns: string
      }

      stok_sayimi_satirlari_olustur: {
        Args: { p_sayim_id: string }
        Returns: number
      }
      stok_sayimi_uygula: {
        Args: { p_sayim_id: string; p_operator?: string | null }
        Returns: { guncellenen: number; hareket: number }[]
      }

      montaj_sure_hesapla: {
        Args: { p_bas: string; p_bit: string; p_operator_id: string | null }
        Returns: { brut: number; mola: number; net: number }[]
      }
      mola_kesisim_dk: {
        Args: { p_bas: string; p_bit: string; p_plan_id: number | null }
        Returns: number
      }
      calculate_customer_segment: {
        Args: {
          p_last_order_date: string
          p_order_count: number
          p_total_spent: number
        }
        Returns: string
      }
      get_all_users_last_sign_in: {
        Args: never
        Returns: {
          auth_id: string
          last_sign_in_at: string
        }[]
      }
      get_distinct_plaka_skus: {
        Args: { p_kategori: string }
        Returns: {
          sku: string
        }[]
      }
      get_user_last_sign_in: { Args: { p_auth_id: string }; Returns: string }
      has_marketplace_access: { Args: never; Returns: boolean }
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
      agent_status: "active" | "paused" | "disabled"
      approval_action_type:
        | "task_status_change"
        | "stock_adjustment"
        | "shipment_release"
        | "price_change"
        | "bulk_operation"
        | "system_config"
      approval_risk_level: "low" | "medium" | "high" | "critical"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
      faaliyet_turu: "FAALIYET" | "FAALIYET_DISI"
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
      output_file_type: "report" | "export" | "pdf" | "csv" | "image" | "other"
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
      task_activity_action:
        | "created"
        | "status_changed"
        | "assigned"
        | "commented"
        | "file_added"
        | "priority_changed"
      task_department:
        | "uretim"
        | "stok"
        | "sevkiyat"
        | "muhasebe"
        | "pazaryeri"
        | "genel"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_source_type: "manual" | "recurring_job" | "alert"
      task_status: "scheduled" | "queue" | "in_progress" | "done"
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
      agent_status: ["active", "paused", "disabled"],
      approval_action_type: [
        "task_status_change",
        "stock_adjustment",
        "shipment_release",
        "price_change",
        "bulk_operation",
        "system_config",
      ],
      approval_risk_level: ["low", "medium", "high", "critical"],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
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
      output_file_type: ["report", "export", "pdf", "csv", "image", "other"],
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
      task_activity_action: [
        "created",
        "status_changed",
        "assigned",
        "commented",
        "file_added",
        "priority_changed",
      ],
      task_department: [
        "uretim",
        "stok",
        "sevkiyat",
        "muhasebe",
        "pazaryeri",
        "genel",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_source_type: ["manual", "recurring_job", "alert"],
      task_status: ["scheduled", "queue", "in_progress", "done"],
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
export type Product = Database['public']['Tables']['products']['Row'];
export type AllPart = Database['public']['Tables']['all_parts']['Row'];
export type Plaka = Database['public']['Tables']['plakalar']['Row'];
export type PlakaPart = Database['public']['Tables']['plaka_parts']['Row'];
export type AssemblyStep = Database['public']['Tables']['assembly_steps']['Row'];
export type StepBom = Database['public']['Tables']['step_bom']['Row'];
export type CutBatch = Database['public']['Tables']['cut_batches']['Row'];
export type CutLine = Database['public']['Tables']['cut_lines']['Row'];
export type Clean = Database['public']['Tables']['clean']['Row'];
export type PackEvent = Database['public']['Tables']['pack_events']['Row'];
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
export type YariMamulStok = Database['public']['Tables']['yari_mamul_stok']['Row'];
export type HazirElemanAkis = Database['public']['Tables']['hazir_eleman_akis']['Row'];
export type IadeGiris = Database['public']['Tables']['iade_giris']['Row'];
export type Attendance = Database['public']['Tables']['attendance']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationRead = Database['public']['Tables']['notification_reads']['Row'];
export type MontajSession = Database['public']['Tables']['montaj_sessions']['Row'];
export type KutuUretim = Database['public']['Tables']['kutu_uretim']['Row'];
export type KesimMakinesi = Database['public']['Tables']['kesim_makinesi']['Row'];
export type Sevkiyat = Database['public']['Tables']['sevkiyat']['Row'];
export type SevkiyatItem = Database['public']['Tables']['sevkiyat_items']['Row'];
export type SevkiyatFiyat = Database['public']['Tables']['sevkiyat_fiyatlar']['Row'];
export type PaletSablon = Database['public']['Tables']['sevkiyat_palet_sablon']['Row'];
export type NakitDonem = Database['public']['Tables']['nakit_donemler']['Row'];
export type NakitGiris = Database['public']['Tables']['nakit_girisler']['Row'];
export type NakitCikis = Database['public']['Tables']['nakit_cikislar']['Row'];
export type Odeme = Database['public']['Tables']['odemeler']['Row'];
export type NakitGirisTakip = Database['public']['Tables']['nakit_giris_takip']['Row'];
export type FaaliyetDonem = Database['public']['Tables']['faaliyet_donemler']['Row'];
export type SatisGiris = Database['public']['Tables']['satis_giris']['Row'];
export type MaliyetGiris = Database['public']['Tables']['maliyet_giris']['Row'];
export type KarlilikData = Database['public']['Tables']['karlilik_data']['Row'];
export type IkasOrder = Database['public']['Tables']['ikas_orders']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskComment = Database['public']['Tables']['task_comments']['Row'];
export type TaskAttachment = Database['public']['Tables']['task_attachments']['Row'];
export type TaskActivity = Database['public']['Tables']['task_activity']['Row'];
export type OpsAgent = Database['public']['Tables']['ops_agents']['Row'];
export type OpsApproval = Database['public']['Tables']['ops_approvals']['Row'];
export type OpsOutput = Database['public']['Tables']['ops_outputs']['Row'];
export type AgentMemory = Database['public']['Tables']['agent_memory']['Row'];
export type AgentAction = Database['public']['Tables']['agent_actions']['Row'];
export type AgentMessage = Database['public']['Tables']['agent_messages']['Row'];
export type Alert = Database['public']['Tables']['alerts']['Row'];
export type JobDefinition = Database['public']['Tables']['job_definitions']['Row'];
export type JobRun = Database['public']['Tables']['job_runs']['Row'];
export type MonitorDefinition = Database['public']['Tables']['monitor_definitions']['Row'];
export type TaskTemplate = Database['public']['Tables']['task_templates']['Row'];
export type RecurringTask = Database['public']['Tables']['recurring_tasks']['Row'];
export type TaskRun = Database['public']['Tables']['task_runs']['Row'];
export type MakineDurumLog = Database['public']['Tables']['makine_durum_log']['Row'];
export type PartType = Database['public']['Enums']['part_type'];
export type ProductCategory = Database['public']['Enums']['product_category'];
export type UserRole = Database['public']['Enums']['user_role'];
export type Station = Database['public']['Enums']['station'];
export type DovizKuru = Database['public']['Tables']['doviz_kurlari']['Row'];
export type SatisSatiri = Database['public']['Tables']['satis_satirlari']['Row'];
export type AgentChat = Database['public']['Tables']['agent_chats']['Row'];
export type SkuMapping = Database['public']['Tables']['sku_mappings']['Row'];
export type IkasCustomerDB = Database['public']['Tables']['ikas_customers']['Row'];
