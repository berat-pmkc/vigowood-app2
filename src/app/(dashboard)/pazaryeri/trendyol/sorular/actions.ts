"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { answerQuestion as apiAnswerQuestion, isUsingMockData } from "@/lib/trendyol";

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
    revalidatePath("/pazaryeri/trendyol/sorular");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
