"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { answerQuestion as apiAnswerQuestion } from "@/lib/trendyol";
import { createClient } from "@supabase/supabase-js";

type ActionResult = { success: true } | { success: false; error: string };

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function answerQuestion(
  questionId: number,
  text: string
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (!text || text.trim().length < 10) {
      return { success: false, error: "Cevap en az 10 karakter olmalıdır" };
    }
    if (text.length > 2000) {
      return { success: false, error: "Cevap en fazla 2000 karakter olabilir" };
    }

    await apiAnswerQuestion(questionId, text.trim());

    // Dual-write: update local DB
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase
        .from("trendyol_questions")
        .update({
          status: "ANSWERED",
          answer_text: text.trim(),
          answer_date: Date.now(),
        })
        .eq("id", questionId);
    } catch (dbErr) {
      console.warn("[Trendyol] Local DB update failed:", dbErr);
    }

    revalidatePath("/pazaryeri/trendyol/sorular");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
