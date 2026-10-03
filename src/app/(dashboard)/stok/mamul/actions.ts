"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";


async function requireStockAccess() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

export async function updateKritikStok(
  sku: string,
  mamul_stok_kritik: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireStockAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("products")
      .update({ mamul_stok_kritik })
      .eq("sku", sku);

    if (error) throw error;

    revalidatePath("/stok/mamul");
    revalidatePath("/stok/kritik-stok");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}
