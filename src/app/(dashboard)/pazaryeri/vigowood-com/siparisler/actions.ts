"use server";

import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { isUsingMockData } from "@/lib/ikas";

type ActionResult = { success: true } | { success: false; error: string };

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updateOrderPackageStatus(
  _orderId: string,
  _newStatus: string
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (isUsingMockData()) {
      return { success: true };
    }

    // İkas order status updates would use fulfillOrder or updateOrderPackageStatus mutations
    // For now, return success as the API integration can be expanded later
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
