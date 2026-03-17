/**
 * Server-only auth helpers — do NOT import in client components
 */
import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database, UserRole, Station } from "@/lib/supabase/types";

export type UserProfile = Omit<Database["public"]["Tables"]["users"]["Row"], "password_plain">;

/** Auth metadata from Supabase auth (operator selection etc.) */
export type AuthMeta = {
  operatorId: string | undefined;
  operatorName: string | undefined;
};

/**
 * Get the current authenticated user + their profile from public.users
 * Wrapped with React cache() — deduplicates within the same request.
 * Layout + page calling this will only hit DB once per request.
 */
export const getCurrentUser = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  // Önce auth_id ile ara
  const { data: profile } = await supabase
    .from("users")
    .select("user_id, auth_id, email, full_name, role, station, is_active, avatar_url, created_at, updated_at, can_be_ops_assignee, allowed_modules")
    .eq("auth_id", authUser.id)
    .single();

  if (profile) return profile;

  // auth_id eşleşmezse email ile fallback + auth_id'yi otomatik bağla
  if (authUser.email) {
    const { data: emailProfile } = await supabase
      .from("users")
      .select("user_id, auth_id, email, full_name, role, station, is_active, avatar_url, created_at, updated_at, can_be_ops_assignee, allowed_modules")
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
});

/**
 * Get current user profile + auth metadata (operator info).
 * Reuses getCurrentUser() (cache()'d) so the users table query
 * is deduplicated if both layout and page call these functions.
 * Only adds one extra getUser() call for operator metadata.
 */
export const getCurrentUserWithAuth = cache(async (): Promise<{
  profile: UserProfile;
  auth: AuthMeta;
} | null> => {
  const profile = await getCurrentUser(); // deduplicated via cache()
  if (!profile) return null;

  // Extra getUser() for operator metadata (JWT-based, fast)
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  return {
    profile,
    auth: {
      operatorId: authUser?.user_metadata?.selected_operator_id as string | undefined,
      operatorName: authUser?.user_metadata?.selected_operator_name as string | undefined,
    },
  };
});

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
    .select("user_id, full_name, station, avatar_url")
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
