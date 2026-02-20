"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const STOCK_ACCESS_ROLES = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
] as const;

async function requireStockAccess() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role as (typeof STOCK_ACCESS_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

export async function updateYariMamulKritikStok(
  partId: string,
  kritikStok: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireStockAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("all_parts")
      .update({ hazir_eleman_kritik_stok: kritikStok })
      .eq("part_id", partId);

    if (error) throw error;

    revalidatePath("/stok/yari-mamul");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}
