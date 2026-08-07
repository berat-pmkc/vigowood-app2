"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  cutBatchUpdateSchema,
  cutLineUpdateSchema,
  montajSessionUpdateSchema,
  packEventUpdateSchema,
} from "@/lib/validations";
import type { CutBatch, CutLine, MontajSession, PackEvent } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

const REVALIDATE_PATH = "/admin/uretim-db";

// ─── FETCH ─────────────────────────────────────────────────────

interface FetchParams {
  search?: string;
  durum?: string;
  dateFrom?: string;
  dateTo?: string;
  operator?: string;
  sortColumn: string;
  sortOrder: boolean; // true = ascending
  from: number;
  to: number;
}

interface KesimFetchParams extends FetchParams {
  makine?: string;
}

export async function fetchCutBatches(
  params: KesimFetchParams
): Promise<{ data: CutBatch[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("cut_batches")
    .select("*", { count: "exact" });

  if (params.search) {
    query = query.or(
      `cut_id.ilike.%${params.search}%,sku.ilike.%${params.search}%,plaka_id.ilike.%${params.search}%,operator_id.ilike.%${params.search}%`
    );
  }
  if (params.durum) {
    query = query.eq("durum", params.durum);
  }
  if (params.makine) {
    query = query.eq("makine_id", params.makine);
  }
  if (params.dateFrom) {
    query = query.gte("tarih", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("tarih", params.dateTo + "T23:59:59.999Z");
  }
  if (params.operator) {
    query = query.ilike("operator_id", `%${params.operator}%`);
  }

  const { data, count, error } = await query
    .order(params.sortColumn, { ascending: params.sortOrder })
    .range(params.from, params.to);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as CutBatch[], count: count ?? 0 };
}

export async function fetchCutLines(cutId: string): Promise<CutLine[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cut_lines")
    .select("*")
    .eq("cut_id", cutId)
    .order("cut_line_id");

  if (error) throw new Error(error.message);
  return (data ?? []) as CutLine[];
}

export async function fetchMontajSessions(
  params: FetchParams
): Promise<{ data: MontajSession[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("montaj_sessions")
    .select("*", { count: "exact" });

  if (params.search) {
    query = query.or(
      `session_id.ilike.%${params.search}%,sku.ilike.%${params.search}%,operator_name.ilike.%${params.search}%,operator_id.ilike.%${params.search}%`
    );
  }
  if (params.durum) {
    query = query.eq("durum", params.durum);
  }
  if (params.dateFrom) {
    query = query.gte("start_time", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("start_time", params.dateTo + "T23:59:59.999Z");
  }
  if (params.operator) {
    query = query.ilike("operator_id", `%${params.operator}%`);
  }

  const { data, count, error } = await query
    .order(params.sortColumn, { ascending: params.sortOrder })
    .range(params.from, params.to);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as MontajSession[], count: count ?? 0 };
}

export async function fetchPackEvents(
  params: FetchParams
): Promise<{ data: PackEvent[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("pack_events")
    .select("*", { count: "exact" });

  if (params.search) {
    query = query.or(
      `session_id.ilike.%${params.search}%,sku.ilike.%${params.search}%,operator_name.ilike.%${params.search}%,operator_id.ilike.%${params.search}%`
    );
  }
  if (params.durum) {
    query = query.eq("durum", params.durum);
  }
  if (params.dateFrom) {
    query = query.gte("tarih", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("tarih", params.dateTo + "T23:59:59.999Z");
  }
  if (params.operator) {
    query = query.ilike("operator_id", `%${params.operator}%`);
  }

  const { data, count, error } = await query
    .order(params.sortColumn, { ascending: params.sortOrder })
    .range(params.from, params.to);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as PackEvent[], count: count ?? 0 };
}

// ─── UPDATE ────────────────────────────────────────────────────

export async function updateCutBatch(
  cutId: string,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = cutBatchUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("cut_batches")
      .update({
        sku: parsed.data.sku,
        plaka_id: parsed.data.plaka_id,
        makine_id: parsed.data.makine_id,
        adet: parsed.data.adet,
        operator_id: parsed.data.operator_id,
        durum: parsed.data.durum,
        plk_notu: parsed.data.plk_notu,
        tarih: parsed.data.tarih,
        baslama_zamani: parsed.data.baslama_zamani,
        bitis_zamani: parsed.data.bitis_zamani,
      })
      .eq("cut_id", cutId);

    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateCutLine(
  cutLineId: string,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = cutLineUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("cut_lines")
      .update({
        part_id: parsed.data.part_id,
        adet: parsed.data.adet,
        not_text: parsed.data.not_text,
        renk: parsed.data.renk,
      })
      .eq("cut_line_id", cutLineId);

    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateMontajSession(
  sessionId: string,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = montajSessionUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await createClient();

    // Birim montaj süresini yeniden hesapla — molalar düşülmüş net süreden.
    // Seans kapatma akışıyla aynı mantık; elle düzeltilen kayıtlarda da
    // aynı sonucu vermesi için.
    let birimMontajDk: number | null = null;
    let brutDk: number | null = null;
    let molaDk: number | null = null;
    let netDk: number | null = null;

    if (parsed.data.start_time && parsed.data.end_time && parsed.data.qty && parsed.data.worker_count) {
      const { data: sureData } = await supabase.rpc("montaj_sure_hesapla", {
        p_bas: parsed.data.start_time,
        p_bit: parsed.data.end_time,
        p_operator_id: parsed.data.operator_id ?? null,
      });

      const sure = Array.isArray(sureData) ? sureData[0] : sureData;
      if (sure) {
        brutDk = Number(sure.brut);
        molaDk = Number(sure.mola);
        netDk = Number(sure.net);
      }

      if (netDk !== null && netDk > 0 && parsed.data.qty > 0 && parsed.data.worker_count > 0) {
        birimMontajDk =
          Math.round((netDk / (parsed.data.qty * parsed.data.worker_count)) * 100) / 100;
      }
    }
    const { error } = await supabase
      .from("montaj_sessions")
      .update({
        sku: parsed.data.sku,
        step_name: parsed.data.step_name,
        durum: parsed.data.durum,
        operator_id: parsed.data.operator_id,
        operator_name: parsed.data.operator_name,
        qty: parsed.data.qty,
        worker_count: parsed.data.worker_count,
        notes: parsed.data.notes,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        is_final_step: parsed.data.is_final_step,
        ...(birimMontajDk !== null ? { birim_montaj_dk: birimMontajDk } : {}),
        ...(netDk !== null
          ? { brut_sure_dk: brutDk, mola_dk: molaDk, net_sure_dk: netDk }
          : {}),
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updatePackEvent(
  sessionId: string,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = packEventUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    // Recalculate birim_paketleme_dk
    let birimPaketlemeDk: number | null = null;
    if (parsed.data.start_time && parsed.data.end_time && parsed.data.qty && parsed.data.worker_count) {
      const start = new Date(parsed.data.start_time).getTime();
      const end = new Date(parsed.data.end_time).getTime();
      const diffMinutes = (end - start) / 60000;
      if (diffMinutes > 0 && parsed.data.qty > 0 && parsed.data.worker_count > 0) {
        birimPaketlemeDk = Math.round((diffMinutes / (parsed.data.qty * parsed.data.worker_count)) * 100) / 100;
      }
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("pack_events")
      .update({
        sku: parsed.data.sku,
        durum: parsed.data.durum,
        operator_id: parsed.data.operator_id,
        operator_name: parsed.data.operator_name,
        qty: parsed.data.qty,
        worker_count: parsed.data.worker_count,
        not_text: parsed.data.not_text,
        tarih: parsed.data.tarih,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        ...(birimPaketlemeDk !== null ? { birim_paketleme_dk: birimPaketlemeDk } : {}),
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteCutBatch(cutId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("cut_batches").delete().eq("cut_id", cutId);
    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteCutLine(cutLineId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("cut_lines").delete().eq("cut_line_id", cutLineId);
    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteMontajSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("montaj_sessions").delete().eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deletePackEvent(sessionId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("pack_events").delete().eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };
    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
