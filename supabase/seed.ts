/**
 * VigoWood — Seed Script
 *
 * 1. Creates Supabase Auth accounts for 18 email users
 * 2. Links auth_id to public.users table
 *
 * Usage:
 *   npx tsx supabase/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Script proje kökünden çalıştırılır: npx tsx supabase/seed.ts
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Default password — users should change on first login
const DEFAULT_PASSWORD = "VigoWood2024!";

// All users with email addresses (to be created in Supabase Auth)
const emailUsers = [
  { user_id: "VW001", email: "hasan@hasmob.com.tr" },
  { user_id: "VW002", email: "mustafa@hasmob.com.tr" },
  { user_id: "VW003", email: "ahmet@hasmob.com.tr" },
  { user_id: "VW004", email: "turgay@vigowood.com" },
  { user_id: "VW005", email: "c.sedat@vigowood.com" },
  { user_id: "VW006", email: "sinan@vigowood.com" },
  { user_id: "VW007", email: "yunus@hasmob.com.tr" },
  { user_id: "VW008", email: "emrah@hasmob.com.tr" },
  { user_id: "VW009", email: "berat@vigowood.com" },
  { user_id: "VW010", email: "zehra@vigowood.com" },
  { user_id: "VW011", email: "asli@vigowood.com" },
  { user_id: "VW012", email: "kesim@vigowood.com" },
  { user_id: "VW013", email: "temizlik@vigowood.com" },
  { user_id: "VW014", email: "montaj@vigowood.com" },
  { user_id: "VW015", email: "paketleme@vigowood.com" },
  { user_id: "VW048", email: "montaj2@vigowood.com" },
  { user_id: "VW049", email: "montaj3@vigowood.com" },
  { user_id: "VW050", email: "kutu@vigowood.com" },
];

async function seed() {
  console.log("🌱 VigoWood Seed Script başlatılıyor...\n");

  let created = 0;
  let linked = 0;
  let errors = 0;

  for (const user of emailUsers) {
    // 1. Create auth user (skip if already exists)
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: user.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

    let authId: string | null = null;

    if (authError) {
      if (authError.message.includes("already been registered")) {
        // User exists — fetch their auth id
        const { data: existing } = await supabase.auth.admin.listUsers();
        const found = existing?.users?.find((u) => u.email === user.email);
        if (found) {
          authId = found.id;
          console.log(`  ⏭️  ${user.email} zaten mevcut (${authId})`);
        }
      } else {
        console.error(`  ❌ Auth error for ${user.email}:`, authError.message);
        errors++;
        continue;
      }
    } else {
      authId = authData.user.id;
      created++;
      console.log(`  ✅ Auth oluşturuldu: ${user.email} (${authId})`);
    }

    // 2. Link auth_id to public.users
    if (authId) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ auth_id: authId })
        .eq("user_id", user.user_id);

      if (updateError) {
        console.error(
          `  ❌ Link error for ${user.user_id}:`,
          updateError.message
        );
        errors++;
      } else {
        linked++;
      }
    }
  }

  console.log(`\n📊 Sonuç:`);
  console.log(`   Auth oluşturulan: ${created}`);
  console.log(`   Bağlantı kurulan: ${linked}`);
  console.log(`   Hata: ${errors}`);
  console.log(`\n⚠️  Varsayılan şifre: ${DEFAULT_PASSWORD}`);
  console.log(`   Kullanıcılar ilk girişte şifrelerini değiştirmelidir.`);
}

seed().catch(console.error);
