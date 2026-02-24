"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { updateStockAndPrice, isUsingMockData } from "@/lib/trendyol";
import type { TrendyolStockPriceItem } from "@/lib/trendyol/types";

type ActionResult = { success: true; batchRequestId?: string } | { success: false; error: string };

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updateProductStockPrice(
  items: TrendyolStockPriceItem[]
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (items.length === 0) {
      return { success: false, error: "Güncellenecek ürün bulunamadı" };
    }

    if (items.length > 1000) {
      return { success: false, error: "Tek seferde en fazla 1000 ürün güncellenebilir" };
    }

    const result = await updateStockAndPrice(items);
    revalidatePath("/pazaryeri/trendyol/urunler");
    return { success: true, batchRequestId: result.batchRequestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
