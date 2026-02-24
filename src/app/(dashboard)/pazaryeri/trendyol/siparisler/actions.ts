"use server";

import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { updatePackageStatus, isUsingMockData } from "@/lib/trendyol";

type ActionResult = { success: true } | { success: false; error: string };

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updateOrderStatus(
  packageId: number,
  lineId: number,
  quantity: number,
  newStatus: "Picking" | "Invoiced",
  invoiceNumber?: string
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();

    if (isUsingMockData()) {
      return { success: true };
    }

    const params: {
      lines: { lineId: number; quantity: number }[];
      params: Record<string, string>;
      status: "Picking" | "Invoiced";
    } = {
      lines: [{ lineId, quantity }],
      params: {},
      status: newStatus,
    };

    if (newStatus === "Invoiced" && invoiceNumber) {
      params.params = { invoiceNumber };
    }

    await updatePackageStatus(packageId, params);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
