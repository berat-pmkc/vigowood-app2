"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { iadeGirisSchema } from "@/lib/validations";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireStockAccess() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** Aktif ürünleri getir (iade formu combobox için) */
export async function getActiveProducts() {
  try {
    await requireStockAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori, stok_aktif")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni iade girişi */
export async function addIadeGiris(formData: {
  sku: string;
  qty: number;
  durum: string;
  iade_nedeni: string;
  musteri_bilgisi: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireStockAccess();

    const parsed = iadeGirisSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;

    // Ürün kontrolü
    const { data: productData } = await supabase
      .from("products")
      .select("sku, stok_aktif")
      .eq("sku", parsed.data.sku)
      .single();

    const product = productData as { sku: string; stok_aktif: number } | null;
    if (!product) return { success: false, error: "Ürün bulunamadı" };

    // Generate iade_id: IAD-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let iadeId = `IAD-${datePart}-${timePart}`;

    // Uniqueness check
    const { data: existing } = await supabase
      .from("iade_giris")
      .select("iade_id")
      .eq("iade_id", iadeId)
      .limit(1);

    if (existing && existing.length > 0) {
      iadeId = `${iadeId}-${pad(now.getMilliseconds())}`;
    }

    // INSERT iade_giris
    const { error: insertError } = await supabase.from("iade_giris").insert({
      iade_id: iadeId,
      tarih: now.toISOString(),
      sku: parsed.data.sku,
      qty: parsed.data.qty,
      durum: parsed.data.durum,
      iade_nedeni: parsed.data.iade_nedeni,
      musteri_bilgisi: parsed.data.musteri_bilgisi || null,
      operator: operatorId,
    });

    if (insertError) return { success: false, error: insertError.message };

    // Kullanılabilir iade → stok güncelle
    if (parsed.data.durum === "Kullanilabilir") {
      // INSERT stock_movements (pozitif qty = IN)
      const { error: movError } = await supabase.from("stock_movements").insert({
        tarih: now.toISOString(),
        sku: parsed.data.sku,
        qty: parsed.data.qty,
        source: "iade",
        source_row_id: iadeId,
      });

      if (movError) return { success: false, error: movError.message };

      // UPDATE products stok
      const newStok = (product.stok_aktif || 0) + parsed.data.qty;
      const { error: updateError } = await supabase
        .from("products")
        .update({ stok_aktif: newStok })
        .eq("sku", parsed.data.sku);

      if (updateError) return { success: false, error: updateError.message };
    }

    revalidatePath("/stok/iade");
    revalidatePath("/stok/mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
