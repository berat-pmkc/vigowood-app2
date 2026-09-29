"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productUpdateSchema, productCreateSchema } from "@/lib/validations";
import type { ProductCategory, Database } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };
type Product = Database["public"]["Tables"]["products"]["Row"];

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createProduct(
  formData: {
    sku: string;
    urun_adi: string;
    kategori: string;
    urun_grubu?: string;
    aktif_mi: boolean;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Check if SKU already exists
    const { data: existing } = await supabase
      .from("products")
      .select("sku")
      .eq("sku", parsed.data.sku)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "Bu SKU zaten kullanılıyor" };
    }

    const { error } = await supabase.from("products").insert({
      sku: parsed.data.sku,
      urun_adi: parsed.data.urun_adi,
      kategori: parsed.data.kategori as ProductCategory,
      urun_grubu: parsed.data.urun_grubu || null,
      aktif_mi: parsed.data.aktif_mi,
      stok_aktif: 0,
      gunluk_satis: 0,
      aylik_uretim: 0,
      gecen_ay_uretim: 0,
      satilan_gun_sayisi: 0,
      toplam_satis: 0,
      mamul_stok_kritik: 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateProduct(
  sku: string,
  formData: {
    urun_adi: string;
    kategori: string;
    urun_grubu?: string;
    aktif_mi: boolean;
    kutu_boy_cm?: number | null;
    kutu_en_cm?: number | null;
    kutu_yukseklik_cm?: number | null;
    urun_agirlik_kg?: number | null;
    kutu_agirlik_kg?: number | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    // Desi hesapla: (boy * en * yükseklik) / 3000
    const boy = parsed.data.kutu_boy_cm ?? null;
    const en = parsed.data.kutu_en_cm ?? null;
    const yuk = parsed.data.kutu_yukseklik_cm ?? null;
    const desi = boy && en && yuk ? Math.round((boy * en * yuk) / 3000 * 100) / 100 : null;

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({
        urun_adi: parsed.data.urun_adi,
        kategori: parsed.data.kategori as ProductCategory,
        urun_grubu: parsed.data.urun_grubu || null,
        aktif_mi: parsed.data.aktif_mi,
        kutu_boy_cm: boy,
        kutu_en_cm: en,
        kutu_yukseklik_cm: yuk,
        urun_agirlik_kg: parsed.data.urun_agirlik_kg ?? null,
        kutu_agirlik_kg: parsed.data.kutu_agirlik_kg ?? null,
        desi,
      })
      .eq("sku", sku);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkToggleActive(
  skus: string[],
  aktif: boolean
): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (skus.length === 0) {
      return { success: false, error: "Hiç ürün seçilmedi" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ aktif_mi: aktif })
      .in("sku", skus);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function exportProducts(): Promise<
  { success: true; data: Product[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sku");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Product[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/**
 * Ürün silme. Sabit (RESTRICT/NO ACTION) FK'lerle korunan finansal/fiyatlama
 * tablolarında kayıt varsa silme engellenir — bu veriler sessizce
 * silinmez. assembly_steps ve step_bom (ürünün kendi reçetesi) ürünle
 * birlikte cascade silinir; ancak bu adımlardan biri başka bir ürünün
 * reçetesinde ASM- referansı olarak kullanılıyorsa (DAG güvenliği) silme
 * engellenir. stock_movements, satış geçmişi, sku_mappings gibi salt metin
 * (soft) referanslı geçmiş veriler dokunulmadan (orphan ama korunmuş)
 * bırakılır.
 */
export async function deleteProduct(sku: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // 1. Sabit FK'li (NO ACTION/RESTRICT) tablolarda referans var mı kontrol et
    // (Supabase generated types literal tablo adı istiyor, bu yüzden dinamik
    // .from(table) yerine her tablo ayrı sorgulanıyor.)
    const blockingResults = await Promise.all([
      supabase.from("kesim_talepleri").select("sku").eq("sku", sku).limit(1),
      supabase
        .from("marketplace_listings")
        .select("sku")
        .eq("sku", sku)
        .limit(1),
      supabase.from("pricing_snapshots").select("sku").eq("sku", sku).limit(1),
      supabase
        .from("product_box_dimensions")
        .select("sku")
        .eq("sku", sku)
        .limit(1),
      supabase
        .from("product_target_prices")
        .select("sku")
        .eq("sku", sku)
        .limit(1),
    ]);

    const blockingLabels: string[] = [];
    const blockingLabelsAll = [
      "Kesim Talepleri",
      "Pazaryeri İlanları",
      "Fiyat Geçmişi",
      "Fiyatlama Kutu Ölçüleri",
      "Fiyatlama Hedef Fiyatları",
    ];
    for (let i = 0; i < blockingResults.length; i++) {
      const { data, error } = blockingResults[i];
      if (error) {
        return { success: false, error: error.message };
      }
      if (data && data.length > 0) {
        blockingLabels.push(blockingLabelsAll[i]);
      }
    }

    if (blockingLabels.length > 0) {
      return {
        success: false,
        error: `Bu ürün şu tablolarda kullanılıyor, silinemez: ${blockingLabels.join(
          ", "
        )}. Önce bu kayıtları kaldırın.`,
      };
    }

    // 2. Ürünün kendi montaj adımlarını (assembly_steps + step_bom) topla
    const { data: steps, error: stepsError } = await supabase
      .from("assembly_steps")
      .select("step_id")
      .eq("sku", sku);

    if (stepsError) {
      return { success: false, error: stepsError.message };
    }

    const stepIds = (steps ?? []).map((s) => s.step_id);

    if (stepIds.length > 0) {
      // DAG güvenliği: bu adımlardan biri başka bir ürünün reçetesinde
      // ASM- referansı olarak kullanılıyor mu? (bom/actions.ts deleteStep
      // ile aynı desen)
      const { data: refs, error: refsError } = await supabase
        .from("step_bom")
        .select("step_id, part_id")
        .in("part_id", stepIds);

      if (refsError) {
        return { success: false, error: refsError.message };
      }

      const externalRefs = (refs ?? []).filter(
        (r) => !stepIds.includes(r.step_id)
      );

      if (externalRefs.length > 0) {
        return {
          success: false,
          error:
            "Bu ürünün montaj adımları başka bir ürünün reçetesinde referans olarak kullanılıyor. Önce o referansları kaldırın.",
        };
      }

      // Kendi reçetesi güvenli — cascade sil
      const { error: bomDelError } = await supabase
        .from("step_bom")
        .delete()
        .in("step_id", stepIds);

      if (bomDelError) {
        return { success: false, error: bomDelError.message };
      }

      const { error: stepDelError } = await supabase
        .from("assembly_steps")
        .delete()
        .eq("sku", sku);

      if (stepDelError) {
        return { success: false, error: stepDelError.message };
      }
    }

    // 3. Ürünü sil. plakalar.sku ve plaka_parts.sku SET NULL FK'li olduğu
    // için otomatik olarak null'a düşer — bu kayıtlar (üretim geçmişi)
    // silinmez, sadece SKU bağlantısı kalkar.
    const { error } = await supabase.from("products").delete().eq("sku", sku);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

/**
 * Ürün kopyalama. Tanımlayıcı/statik alanlar (kategori, kutu ölçüleri,
 * ağırlık, desi, koli adedi, ürün grubu, kritik stok eşiği) yeni SKU'ya
 * kopyalanır; birikmiş/hesaplanmış istatistikler (stok, satış, üretim
 * sayaçları) sıfırlanır çünkü yeni SKU'nun geçmişi yoktur. Montaj
 * adımları (assembly_steps) ve reçete (step_bom) DAG'ı yeni step_id'lerle
 * yeniden oluşturulur; ASM- referansları kopyalanan kardeş adımlara göre
 * yeniden eşlenir, gerçek parça/dış referanslar değişmeden kopyalanır.
 * Herhangi bir adımda hata olursa yeni SKU için eklenmiş tüm kayıtlar
 * geri temizlenir.
 */
export async function duplicateProduct(
  sourceSku: string,
  newSku: string,
  newUrunAdi?: string
): Promise<ActionResult & { sku?: string }> {
  const insertedStepIds: string[] = [];
  const insertedBomIds: string[] = [];
  let productInserted = false;
  const trimmedNewSku = newSku.trim();

  const supabase = await createClient();

  try {
    await requireAdmin();

    if (!trimmedNewSku) {
      return { success: false, error: "Yeni SKU gereklidir" };
    }
    if (trimmedNewSku.length > 50) {
      return { success: false, error: "SKU en fazla 50 karakter olabilir" };
    }
    if (trimmedNewSku === sourceSku.trim()) {
      return { success: false, error: "Yeni SKU, kaynak SKU ile aynı olamaz" };
    }

    // Kaynak ürünü getir
    const { data: source, error: sourceError } = await supabase
      .from("products")
      .select("*")
      .eq("sku", sourceSku)
      .single();

    if (sourceError || !source) {
      return { success: false, error: "Kaynak ürün bulunamadı" };
    }

    // Yeni SKU zaten var mı?
    const { data: existing, error: existingError } = await supabase
      .from("products")
      .select("sku")
      .eq("sku", trimmedNewSku)
      .limit(1);

    if (existingError) {
      return { success: false, error: existingError.message };
    }
    if (existing && existing.length > 0) {
      return { success: false, error: "Bu SKU zaten kullanılıyor" };
    }

    // 1. Yeni ürün satırı — sadece tanımlayıcı/statik alanlar kopyalanır
    const { error: insertError } = await supabase.from("products").insert({
      sku: trimmedNewSku,
      urun_adi: newUrunAdi?.trim() || source.urun_adi || null,
      kategori: source.kategori,
      urun_grubu: source.urun_grubu,
      aktif_mi: true,
      renk_kodu: source.renk_kodu,
      kutu_boy_cm: source.kutu_boy_cm,
      kutu_en_cm: source.kutu_en_cm,
      kutu_yukseklik_cm: source.kutu_yukseklik_cm,
      urun_agirlik_kg: source.urun_agirlik_kg,
      kutu_agirlik_kg: source.kutu_agirlik_kg,
      desi: source.desi,
      koli_adedi: source.koli_adedi,
      mamul_stok_kritik: source.mamul_stok_kritik,
      // Birikmiş/hesaplanmış istatistikler — yeni SKU'nun geçmişi yok
      stok_aktif: 0,
      toplam_satis: 0,
      ilk_satis_tarihi: null,
      satilan_gun_sayisi: 0,
      gunluk_satis: 0,
      gecen_ay_uretim: 0,
      aylik_uretim: 0,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
    productInserted = true;

    // 2. Reçete DAG'ını kopyala
    const { data: sourceSteps, error: stepsError } = await supabase
      .from("assembly_steps")
      .select("step_id, step_name, seq_no, is_final_step")
      .eq("sku", sourceSku)
      .order("seq_no", { ascending: true });

    if (stepsError) {
      throw new Error(stepsError.message);
    }

    const stepIdMap = new Map<string, string>(); // eski step_id -> yeni step_id

    for (const step of sourceSteps ?? []) {
      const { data: newStepId, error: idError } = await supabase.rpc(
        "next_id",
        { p_prefix: "ASM-", p_width: 4 }
      );
      if (idError || !newStepId) {
        throw new Error("Adım ID üretilemedi");
      }
      stepIdMap.set(step.step_id, newStepId);
    }

    for (const step of sourceSteps ?? []) {
      const newStepId = stepIdMap.get(step.step_id)!;
      const { error } = await supabase.from("assembly_steps").insert({
        step_id: newStepId,
        sku: trimmedNewSku,
        step_name: step.step_name,
        seq_no: step.seq_no,
        is_final_step: step.is_final_step,
      });
      if (error) {
        throw new Error(error.message);
      }
      insertedStepIds.push(newStepId);
    }

    if (sourceSteps && sourceSteps.length > 0) {
      const oldStepIds = sourceSteps.map((s) => s.step_id);
      const { data: bomItems, error: bomError } = await supabase
        .from("step_bom")
        .select("step_id, part_id, qty_per, kodu, kritik_stok_products")
        .in("step_id", oldStepIds);

      if (bomError) {
        throw new Error(bomError.message);
      }

      for (const item of bomItems ?? []) {
        const newStepId = stepIdMap.get(item.step_id);
        if (!newStepId) continue; // olmamalı, güvenlik amaçlı

        // ASM- referansı kopyalanan bir kardeş adıma işaret ediyorsa yeni
        // step_id'ye yeniden eşle; değilse (gerçek parça veya dış ürün
        // referansı) değiştirmeden kopyala.
        const remappedPartId = stepIdMap.get(item.part_id) ?? item.part_id;

        const { data: newBomId, error: idError } = await supabase.rpc(
          "next_id",
          { p_prefix: "SBOM-", p_width: 4 }
        );
        if (idError || !newBomId) {
          throw new Error("Reçete satırı ID üretilemedi");
        }

        const { error } = await supabase.from("step_bom").insert({
          step_bom_id: newBomId,
          step_id: newStepId,
          part_id: remappedPartId,
          qty_per: item.qty_per,
          kodu: item.kodu,
          kritik_stok_products: item.kritik_stok_products,
        });
        if (error) {
          throw new Error(error.message);
        }
        insertedBomIds.push(newBomId);
      }
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true, sku: trimmedNewSku };
  } catch (e) {
    // Herhangi bir adımda hata: yeni SKU için eklenmiş her şeyi geri temizle
    try {
      if (insertedBomIds.length > 0) {
        await supabase.from("step_bom").delete().in("step_bom_id", insertedBomIds);
      }
      if (insertedStepIds.length > 0) {
        await supabase
          .from("assembly_steps")
          .delete()
          .in("step_id", insertedStepIds);
      }
      if (productInserted) {
        await supabase.from("products").delete().eq("sku", trimmedNewSku);
      }
    } catch {
      // best-effort temizlik
    }

    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function importProducts(
  rows: { sku: string; urun_adi: string; kategori: string; aktif_mi: string }[]
): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let count = 0;
    for (const row of rows) {
      if (!row.sku) continue;
      const { error } = await supabase
        .from("products")
        .upsert(
          {
            sku: row.sku,
            urun_adi: row.urun_adi || null,
            kategori: (row.kategori || "Diğer") as ProductCategory,
            aktif_mi: row.aktif_mi === "true" || row.aktif_mi === "1" || row.aktif_mi === "Evet",
          },
          { onConflict: "sku" }
        );

      if (error) {
        return { success: false, error: `Satır ${row.sku}: ${error.message}` };
      }
      count++;
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
