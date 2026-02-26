"use server";

import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { updatePackageStatus } from "@/lib/trendyol";
import { createClient } from "@supabase/supabase-js";

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

    // API call
    await updatePackageStatus(packageId, params);

    // Dual-write: update local DB
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase
        .from("trendyol_orders")
        .update({ status: newStatus })
        .eq("id", packageId);
    } catch (dbErr) {
      console.warn("[Trendyol] Local DB update failed:", dbErr);
      // Don't fail the action — API call was successful
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
