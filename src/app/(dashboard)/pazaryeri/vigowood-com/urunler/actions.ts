"use server";

import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { updateStock, updatePrice, isUsingMockData } from "@/lib/ikas";
import type { IkasStockUpdateInput, IkasVariantPriceInput } from "@/lib/ikas/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updateProductStock(
  inputs: IkasStockUpdateInput[]
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (isUsingMockData()) {
      return { success: true };
    }

    await updateStock(inputs);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}

export async function updateProductPrice(
  priceListId: string,
  inputs: IkasVariantPriceInput[]
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (isUsingMockData()) {
      return { success: true };
    }

    await updatePrice(priceListId, inputs);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
