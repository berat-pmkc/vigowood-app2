// Will be auto-generated after migrations with:
// npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Manual types for Katman 1 — users table

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      station: Station;
    };
  };
};
