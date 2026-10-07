/**
 * Sunucu tarafı ortak yardımcılar: tipsiz Supabase client, RPC çağrısı, yetki ve hata sarmalayıcıları.
 * "use server" DEĞİL (action dosyaları içe aktarır); istemciden import edilmez.
 */
import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type UserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/constants";
import { TALIMAT_REVALIDATE_PATHS } from "./constants";
import { parseRpcHata } from "./helpers";
import type { ActionResult } from "./types";

/** Yeni tablolar Database tipinde olmadığından tipsiz client */
export async function talimatDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** RPC çağır, hata varsa Error fırlat (mesaj Postgres mesajıdır) */
export async function rpcCagir<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = await talimatDb();
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Oturum + rol doğrulaması. Başarısızsa "Yetkisiz erişim" fırlatır. */
export async function rolGerekli(roller: readonly UserRole[]): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user || !(roller as readonly string[]).includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** Action gövdesini ActionResult'a çevirir; NEXT_REDIRECT hatalarını yeniden fırlatır */
export async function sonucaCevir<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw e;
    const ham = e instanceof Error ? e.message : "Bir hata oluştu";
    const { kod, mesaj } = parseRpcHata(ham);
    return { success: false, error: mesaj, ...(kod ? { code: kod } : {}) };
  }
}

export function talimatYenile(): void {
  for (const p of TALIMAT_REVALIDATE_PATHS) revalidatePath(p);
}
