"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erisim");
  }
  return user;
}

/**
 * Temizlik baslat: Bir cut_batch'in tum cut_lines'i icin clean record olustur
 * bekliyor → temizleniyor
 */
export async function startClean(cutId: string): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();
    const supabase = await createClient();

    // Operator bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // cut_batch kontrolu
    const { data: batchData } = await supabase
      .from("cut_batches")
      .select("cut_id, durum")
      .eq("cut_id", cutId)
      .single();

    const batch = batchData as { cut_id: string; durum: string } | null;
    if (!batch) return { success: false, error: "Kesim bulunamadi" };
    if (batch.durum !== "tamamlandi") {
      return { success: false, error: "Sadece tamamlanmis kesimler temizlige baslayabilir" };
    }

    // Cut lines al
    const { data: lines } = await supabase
      .from("cut_lines")
      .select("cut_line_id")
      .eq("cut_id", cutId);

    if (!lines || lines.length === 0) {
      return { success: false, error: "Bu kesime ait parca bulunamadi" };
    }

    const cutLineIds = lines.map((l) => l.cut_line_id);

    // Mevcut clean kayitlari kontrol (idempotency)
    const { data: existingCleans } = await supabase
      .from("clean")
      .select("cutline_id, status")
      .in("cutline_id", cutLineIds);

    const existingMap = new Map(
      (existingCleans ?? []).map((c) => [c.cutline_id, c.status])
    );

    // Zaten temizleniyor veya tamamlandi olan varsa baslatma
    const hasActive = Array.from(existingMap.values()).some(
      (s) => s === "temizleniyor" || s === "tamamlandi"
    );
    if (hasActive) {
      return { success: false, error: "Bu kesimin temizligi zaten baslamis veya tamamlanmis" };
    }

    // clean_batch_id olustur (CLN-XXXX)
    const { data: lastClean } = await supabase
      .from("clean")
      .select("clean_batch_id")
      .like("clean_batch_id", "CLN-%")
      .order("clean_batch_id", { ascending: false })
      .limit(1);

    let clnNum = 1;
    if (lastClean && lastClean.length > 0) {
      const match = lastClean[0].clean_batch_id.match(/CLN-(\d+)/);
      if (match) clnNum = parseInt(match[1], 10) + 1;
    }
    const cleanBatchId = `CLN-${String(clnNum).padStart(4, "0")}`;
    const now = new Date().toISOString();

    // Insert veya update
    const toInsert = cutLineIds.filter((id) => !existingMap.has(id));
    const toUpdate = cutLineIds.filter((id) => existingMap.get(id) === "bekliyor");

    if (toInsert.length > 0) {
      const inserts = toInsert.map((cutlineId) => ({
        cutline_id: cutlineId,
        clean_batch_id: cleanBatchId,
        status: "temizleniyor",
        start_time: now,
        operator_id: operatorId,
        operator_name: operatorName,
        email: email,
      }));

      const { error: insertError } = await supabase.from("clean").insert(inserts);
      if (insertError) return { success: false, error: insertError.message };
    }

    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("clean")
        .update({
          status: "temizleniyor",
          start_time: now,
          clean_batch_id: cleanBatchId,
          operator_id: operatorId,
          operator_name: operatorName,
          email: email,
        })
        .in("cutline_id", toUpdate);

      if (updateError) return { success: false, error: updateError.message };
    }

    revalidatePath("/uretim/temizlik");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata olustu" };
  }
}

/**
 * Temizlik tamamla: temizleniyor → tamamlandi
 */
export async function completeClean(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Cut lines al
    const { data: lines } = await supabase
      .from("cut_lines")
      .select("cut_line_id")
      .eq("cut_id", cutId);

    if (!lines || lines.length === 0) {
      return { success: false, error: "Parca bulunamadi" };
    }

    const cutLineIds = lines.map((l) => l.cut_line_id);

    // Temizleniyor durumunda olduklarini kontrol et
    const { data: cleans } = await supabase
      .from("clean")
      .select("cutline_id, status")
      .in("cutline_id", cutLineIds)
      .eq("status", "temizleniyor");

    if (!cleans || cleans.length === 0) {
      return { success: false, error: "Temizleniyor durumunda kayit bulunamadi" };
    }

    const now = new Date().toISOString();
    const cleanLineIds = cleans.map((c) => c.cutline_id);

    const { error } = await supabase
      .from("clean")
      .update({ status: "tamamlandi", end_time: now })
      .in("cutline_id", cleanLineIds);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/temizlik");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata olustu" };
  }
}

/**
 * Temizlik iptal: temizleniyor → bekliyor (yanlis baslatma duzeltme)
 */
export async function cancelClean(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: lines } = await supabase
      .from("cut_lines")
      .select("cut_line_id")
      .eq("cut_id", cutId);

    if (!lines || lines.length === 0) {
      return { success: false, error: "Parca bulunamadi" };
    }

    const cutLineIds = lines.map((l) => l.cut_line_id);

    const { error } = await supabase
      .from("clean")
      .update({ status: "bekliyor", start_time: null, operator_id: null, operator_name: null })
      .in("cutline_id", cutLineIds)
      .eq("status", "temizleniyor");

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/temizlik");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata olustu" };
  }
}
