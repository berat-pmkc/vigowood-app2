"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";

type Sonuc = { success: true } | { success: false; error: string };

async function yetkiKontrol() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

/** Seçili ürün + depo için o anki bakiyeyi döner (form üzerinde canlı gösterim için) */
export async function depoBakiyeGetir(
  sku: string,
  depoId: string,
): Promise<{ success: true; miktar: number } | { success: false; error: string }> {
  try {
    await yetkiKontrol();
    if (!sku || !depoId) return { success: true, miktar: 0 };
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("urun_depo_stok")
      .select("miktar")
      .eq("sku", sku)
      .eq("depo_id", depoId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, miktar: Number(data?.miktar ?? 0) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** İki depo arasında ürün transferi yapar (depo_transfer RPC'si üzerinden) */
export async function transferOlustur(input: {
  sku: string;
  kaynakDepoId: string;
  hedefDepoId: string;
  miktar: number;
  not?: string;
}): Promise<Sonuc & { transferId?: string }> {
  try {
    await yetkiKontrol();

    if (!input.sku) return { success: false, error: "Ürün seçmelisiniz" };
    if (!input.kaynakDepoId || !input.hedefDepoId) {
      return { success: false, error: "Kaynak ve hedef depo seçmelisiniz" };
    }
    if (input.kaynakDepoId === input.hedefDepoId) {
      return { success: false, error: "Kaynak ve hedef depo aynı olamaz" };
    }
    if (!input.miktar || input.miktar <= 0) {
      return { success: false, error: "Miktar sıfırdan büyük olmalı" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("depo_transfer", {
      p_sku: input.sku,
      p_kaynak: input.kaynakDepoId,
      p_hedef: input.hedefDepoId,
      p_miktar: input.miktar,
      p_not: input.not?.trim() || null,
    });

    if (error) {
      // Postgres RAISE EXCEPTION mesajları zaten Türkçe geliyor (bkz. depo_transfer fonksiyonu)
      return { success: false, error: error.message };
    }

    revalidatePath("/stok/transfer");
    revalidatePath("/stok/mamul");
    return { success: true, transferId: data ?? undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
