/**
 * Server-only auth helpers — do NOT import in client components
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, UserRole, Station } from "@/lib/supabase/types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/**
 * Get the current authenticated user + their profile from public.users
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  // Önce auth_id ile ara
  const { data: profile } = await supabase
    .from("users")
    .select("user_id, auth_id, email, full_name, role, station, is_active, password_plain, created_at, updated_at")
    .eq("auth_id", authUser.id)
    .single();

  if (profile) return profile;

  // auth_id eşleşmezse email ile fallback + auth_id'yi otomatik bağla
  if (authUser.email) {
    const { data: emailProfile } = await supabase
      .from("users")
      .select("user_id, auth_id, email, full_name, role, station, is_active, password_plain, created_at, updated_at")
      .eq("email", authUser.email)
      .single();

    if (emailProfile) {
      // auth_id'yi bağla (bir kere)
      if (!emailProfile.auth_id) {
        await supabase
          .from("users")
          .update({ auth_id: authUser.id })
          .eq("user_id", emailProfile.user_id);
      }
      return { ...emailProfile, auth_id: authUser.id };
    }
  }

  return null;
}

/**
 * Get operators for a given station (used in operator selection page)
 */
export async function getStationOperators(stationEmail: string) {
  const supabase = await createClient();

  // Map station email → station name for operator query
  const stationMap: Record<string, Station[]> = {
    "kesim@vigowood.com": ["Kesim"],
    "temizlik@vigowood.com": ["Temizlik"],
    "montaj@vigowood.com": ["Montaj"],
    "montaj2@vigowood.com": ["Montaj"],
    "montaj3@vigowood.com": ["Montaj"],
    "paketleme@vigowood.com": ["Paketleme"],
    "kutu@vigowood.com": ["Kutu"],
  };

  const stations = stationMap[stationEmail];
  if (!stations) return [];

  const { data } = await supabase
    .from("users")
    .select("user_id, full_name, station")
    .eq("role", "Üretim")
    .eq("is_active", true)
    .in("station", stations)
    .order("full_name");

  return data ?? [];
}

/** Role groups for routing */
export const ADMIN_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
];

export const OFFICE_ROLES: UserRole[] = [
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
  "Pazaryeri Sorumlusu",
  "Mimar",
  "Sevkiyat Sorumlusu",
];

export const STATION_ROLES: UserRole[] = ["Hat", "Üretim"];
