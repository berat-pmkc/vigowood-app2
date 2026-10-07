"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";

export interface DuzeltmeKalemi {
  sku: string;
  qty: number;
  neden: string;
}

export interface DuzeltmeSonucu {
  basarili: number;
  hatalar: { sku: string; hata: string }[];
}

/**
 * Mamül stok düzeltmesi (depo bazlı). Her kalem için stok_duzelt() RPC'si çağrılır:
 * stock_movements'a 'Stok Düzeltme' hareketi + products.stok_aktif güncellemesi.
 * Kalemler birbirinden bağımsızdır; biri hata verirse diğerleri yine yazılır ve hata listelenir.
 */
export async function stokDuzeltToplu(
  depoId: string,
  kalemler: DuzeltmeKalemi[],
): Promise<{ success: true; data: DuzeltmeSonucu } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
      return { success: false, error: "Bu işlem için yetkiniz yok" };
    }
    if (!depoId) return { success: false, error: "Depo seçiniz" };
    if (kalemler.length === 0) return { success: false, error: "Düzeltilecek kalem yok" };

    const supabase = await createClient();
    const sonuc: DuzeltmeSonucu = { basarili: 0, hatalar: [] };

    for (const k of kalemler) {
      if (!Number.isFinite(k.qty) || k.qty === 0) {
        sonuc.hatalar.push({ sku: k.sku, hata: "Miktar 0 olamaz" });
        continue;
      }
      if (!k.neden.trim()) {
        sonuc.hatalar.push({ sku: k.sku, hata: "Neden yazılmadı" });
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("stok_duzelt", {
        p_sku: k.sku,
        p_depo_id: depoId,
        p_qty: k.qty,
        p_neden: k.neden.trim(),
      });
      if (error) sonuc.hatalar.push({ sku: k.sku, hata: error.message });
      else sonuc.basarili++;
    }

    revalidatePath("/stok/sayim/duzenleme");
    revalidatePath("/stok/mamul");
    return { success: true, data: sonuc };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
