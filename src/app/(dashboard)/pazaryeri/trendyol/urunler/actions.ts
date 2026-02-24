"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { updateStockAndPrice } from "@/lib/trendyol";
import { createClient } from "@supabase/supabase-js";
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

    // Dual-write: update local DB
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      for (const item of items) {
        const updates: Record<string, unknown> = {};
        if (item.quantity !== undefined) updates.quantity = item.quantity;
        if (item.salePrice !== undefined) updates.sale_price = item.salePrice;
        if (item.listPrice !== undefined) updates.list_price = item.listPrice;

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("trendyol_products")
            .update(updates)
            .eq("barcode", item.barcode);
        }
      }
    } catch (dbErr) {
      console.warn("[Trendyol] Local DB update failed:", dbErr);
    }

    revalidatePath("/pazaryeri/trendyol/urunler");
    return { success: true, batchRequestId: result.batchRequestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
