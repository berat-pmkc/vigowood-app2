"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCreateSchema, userUpdateSchema } from "@/lib/validations";
import type { Database } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function getNextUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("user_id")
    .like("user_id", "VW%")
    .order("user_id", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].user_id.replace("VW", ""), 10);
    if (!isNaN(lastNum)) {
      return `VW${String(lastNum + 1).padStart(3, "0")}`;
    }
  }
  return "VW001";
}

export async function createUser(
  formData: {
    user_id: string;
    full_name: string;
    email: string | null;
    role: string;
    station: string;
    password_plain?: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = userCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Check if user_id already exists
    const { data: existingId } = await supabase
      .from("users")
      .select("user_id")
      .eq("user_id", parsed.data.user_id)
      .limit(1);

    if (existingId && existingId.length > 0) {
      return { success: false, error: "Bu Kullanıcı ID zaten kullanılıyor" };
    }

    // Check if email already exists (if provided)
    if (parsed.data.email) {
      const { data: existingEmail } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", parsed.data.email)
        .limit(1);

      if (existingEmail && existingEmail.length > 0) {
        return { success: false, error: "Bu e-posta adresi zaten kullanılıyor" };
      }
    }

    const { error } = await supabase.from("users").insert({
      user_id: parsed.data.user_id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      role: parsed.data.role,
      station: parsed.data.station,
      is_active: true,
      password_plain: formData.password_plain || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/kullanicilar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateUser(
  userId: string,
  formData: {
    full_name: string;
    email: string | null;
    role: string;
    station: string;
    is_active: boolean;
    password_plain?: string | null;
    can_be_ops_assignee?: boolean;
  }
): Promise<ActionResult> {
  try {
    const currentUser = await requireAdmin();

    const parsed = userUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    // Prevent deactivating own account
    if (currentUser.user_id === userId && !parsed.data.is_active) {
      return { success: false, error: "Kendi hesabınızı deaktive edemezsiniz" };
    }

    const supabase = await createClient();

    // Check email uniqueness (exclude current user)
    if (parsed.data.email) {
      const { data: existingEmail } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", parsed.data.email)
        .neq("user_id", userId)
        .limit(1);

      if (existingEmail && existingEmail.length > 0) {
        return { success: false, error: "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor" };
      }
    }

    const { error } = await supabase
      .from("users")
      .update({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        role: parsed.data.role,
        station: parsed.data.station,
        is_active: parsed.data.is_active,
        password_plain: formData.password_plain ?? null,
        ...(formData.can_be_ops_assignee !== undefined
          ? { can_be_ops_assignee: formData.can_be_ops_assignee }
          : {}),
      })
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // If password changed and user has an auth account, update Supabase Auth password
    if (formData.password_plain) {
      const { data: userData } = await supabase
        .from("users")
        .select("auth_id")
        .eq("user_id", userId)
        .single();

      if (userData?.auth_id) {
        const adminClient = createAdminClient();
        const { error: authErr } = await adminClient.auth.admin.updateUserById(
          userData.auth_id,
          { password: formData.password_plain }
        );

        if (authErr) {
          // DB updated but auth failed — warn but don't fail
          return { success: false, error: `Bilgiler güncellendi fakat giriş şifresi güncellenemedi: ${authErr.message}` };
        }
      }
    }

    revalidatePath("/admin/kullanicilar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function uploadUserAvatar(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    if (!file || !userId) return { success: false, error: "Geçersiz istek" };

    // Server-side validation
    const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
    if (!ACCEPTED.includes(file.type)) {
      return { success: false, error: "Sadece JPEG, PNG veya WebP formatı destekleniyor" };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: "Dosya boyutu en fazla 2MB olabilir" };
    }

    const supabase = await createClient();

    // Clean up old avatar files
    const { data: existingFiles } = await supabase.storage
      .from("user-avatars")
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const filesToRemove = existingFiles.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from("user-avatars").remove(filesToRemove);
    }

    // Upload new file
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("user-avatars")
      .upload(path, file);

    if (uploadError) return { success: false, error: uploadError.message };

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("user-avatars")
      .getPublicUrl(path);

    // Update user record
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", userId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/admin/kullanicilar");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteUserAvatar(userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const supabase = await createClient();

    // Delete all files in user's avatar folder
    const { data: existingFiles } = await supabase.storage
      .from("user-avatars")
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const filesToRemove = existingFiles.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from("user-avatars").remove(filesToRemove);
    }

    // Set avatar_url to null
    const { error } = await supabase
      .from("users")
      .update({ avatar_url: null })
      .eq("user_id", userId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/kullanicilar");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const currentUser = await requireAdmin();

    // Prevent deleting own account
    if (currentUser.user_id === userId) {
      return { success: false, error: "Kendi hesabınızı silemezsiniz" };
    }

    const supabase = await createClient();

    // Check references in related tables
    const refChecks = [
      { table: "cut_batches" as const, column: "operator", label: "kesim" },
      { table: "clean" as const, column: "operator", label: "temizlik" },
      { table: "montaj_batches" as const, column: "operator", label: "montaj (eski)" },
      { table: "montaj_sessions" as const, column: "operator_id", label: "montaj" },
      { table: "pack_events" as const, column: "operator", label: "paketleme" },
      { table: "kutu_uretim" as const, column: "operator", label: "kutu üretim" },
      { table: "attendance" as const, column: "employee", label: "yoklama" },
      { table: "hazir_eleman_akis" as const, column: "operator", label: "hazır eleman" },
      { table: "iade_giris" as const, column: "operator", label: "iade" },
    ];

    for (const check of refChecks) {
      const { data: refs } = await supabase
        .from(check.table)
        .select(check.column)
        .eq(check.column, userId)
        .limit(1);

      if (refs && refs.length > 0) {
        return {
          success: false,
          error: `Bu kullanıcı ${check.label} kayıtlarında referans ediliyor, silinemez`,
        };
      }
    }

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/kullanicilar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}
