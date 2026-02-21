/**
 * VigoWood — RLS & Tablo Erişim Testi
 *
 * 1. Service role (RLS bypass) ile veri sayıları
 * 2. Authenticated user ile RLS testi
 * 3. Sayfa sorgularını birebir simüle eder
 *
 * Kullanım:
 *   npx tsx supabase/test-rls-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "sevkiyat_palet_sablon",
  "sevkiyat_fiyatlar",
  "products",
  "stock_movements",
  "sevkiyat",
  "sevkiyat_items",
  "sevkiyat_maliyetler",
  "doviz_kurlari",
  "all_parts",
  "users",
];

const PASSWORD = "VigoWood2024!";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function signIn(email: string): Promise<string | null> {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (error) {
    // Şifreyi sıfırla ve tekrar dene
    const { data: users } = await adminClient.auth.admin.listUsers();
    const found = users?.users?.find((u) => u.email === email);
    if (found) {
      await adminClient.auth.admin.updateUserById(found.id, { password: PASSWORD });
      const { data: retry } = await anonClient.auth.signInWithPassword({
        email,
        password: PASSWORD,
      });
      return retry?.session?.access_token ?? null;
    }
    return null;
  }

  return data.session?.access_token ?? null;
}

function makeAuthClient(token: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ════════════════════════════════════════════════
// TEST 1: Service Role Veri Kontrolü
// ════════════════════════════════════════════════
async function testServiceRoleCounts() {
  console.log("\n═══ TEST 1: Service Role — Veri Mevcut mu? ═══\n");

  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true });
    counts[table] = count ?? 0;
    assert(!error && (count ?? 0) > 0, `${table} veri var (${count} kayıt)`);
  }

  return counts;
}

// ════════════════════════════════════════════════
// TEST 2: Authenticated User RLS Testi
// ════════════════════════════════════════════════
async function testAuthenticatedRLS(serviceCounts: Record<string, number>) {
  console.log("\n═══ TEST 2: Authenticated User — RLS Testi ═══\n");

  const token = await signIn("sinan@vigowood.com");
  assert(token !== null, "Giriş başarılı (sinan@vigowood.com)");
  if (!token) return;

  const c = makeAuthClient(token);

  // getCurrentUser çalışıyor mu?
  const {
    data: { user: authUser },
  } = await c.auth.getUser();
  assert(authUser !== null, "auth.getUser() UUID döndü");

  const { data: dbUser } = await c
    .from("users")
    .select("user_id, role, full_name")
    .eq("auth_id", authUser!.id)
    .single();
  assert(dbUser !== null, `public.users'ta bulundu (${dbUser?.user_id}, ${dbUser?.role})`);

  // Her tablo için SELECT testi
  for (const table of TABLES) {
    const { count, error } = await c
      .from(table)
      .select("*", { count: "exact", head: true });

    const expected = serviceCounts[table];

    if (table === "sevkiyat_maliyetler") {
      // Maliyetler sadece admin/mühendis görebilir — role'e bağlı
      assert(!error, `${table} sorgu hatasız`);
    } else if (table === "users") {
      // Users tablosu kısmi olabilir (RLS)
      assert(!error && (count ?? 0) > 0, `${table} erişim var (${count}/${expected})`);
    } else {
      assert(
        !error && count === expected,
        `${table} tam erişim (${count}/${expected})`
      );
    }
  }

  await anonClient.auth.signOut();
}

// ════════════════════════════════════════════════
// TEST 3: Sayfa Sorgularını Simüle Et
// ════════════════════════════════════════════════
async function testPageQueries() {
  console.log("\n═══ TEST 3: Sayfa Sorguları Simülasyonu ═══\n");

  const token = await signIn("sinan@vigowood.com");
  if (!token) {
    console.log("  ⚠️ Giriş yapılamadı, test atlanıyor");
    return;
  }

  const c = makeAuthClient(token);

  // --- /sevkiyat/sablonlar ---
  console.log("  📄 /sevkiyat/sablonlar");
  const s = await c
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);
  assert(!s.error, `  Şablon sorgu hatasız`);
  assert((s.count ?? 0) > 0, `  Şablon count > 0 (${s.count})`);
  assert((s.data?.length ?? 0) > 0, `  Şablon data.length > 0 (${s.data?.length})`);

  // --- /sevkiyat/fiyatlar ---
  console.log("  📄 /sevkiyat/fiyatlar");
  const f = await c
    .from("sevkiyat_fiyatlar")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);
  assert(!f.error, `  Fiyat sorgu hatasız`);
  assert((f.count ?? 0) > 0, `  Fiyat count > 0 (${f.count})`);
  assert((f.data?.length ?? 0) > 0, `  Fiyat data.length > 0 (${f.data?.length})`);

  // --- /stok/mamul ---
  console.log("  📄 /stok/mamul");
  const m = await c
    .from("products")
    .select("*", { count: "exact" })
    .eq("aktif_mi", true)
    .order("sku", { ascending: true })
    .range(0, 24);
  assert(!m.error, `  Products sorgu hatasız`);
  assert((m.count ?? 0) > 0, `  Products count > 0 (${m.count})`);
  assert((m.data?.length ?? 0) > 0, `  Products data.length > 0 (${m.data?.length})`);

  // --- /stok/mamul (stock_movements) ---
  console.log("  📄 /stok/mamul (hareketler)");
  const sm = await c
    .from("stock_movements")
    .select("*", { count: "exact" })
    .order("tarih", { ascending: false })
    .range(0, 24);
  assert(!sm.error, `  StockMov sorgu hatasız`);
  assert((sm.count ?? 0) > 0, `  StockMov count > 0 (${sm.count})`);

  // --- /sevkiyat/maliyetler ---
  console.log("  📄 /sevkiyat/maliyetler");
  const mal = await c
    .from("sevkiyat_maliyetler")
    .select("*");
  assert(!mal.error, `  Maliyetler sorgu hatasız`);
  // Admin/Mühendis görebilmeli
  assert((mal.data?.length ?? 0) > 0, `  Maliyetler data > 0 (${mal.data?.length})`);

  // --- /sevkiyat/kurlar ---
  console.log("  📄 /sevkiyat/kurlar");
  const kur = await c
    .from("doviz_kurlari")
    .select("*")
    .order("tarih", { ascending: false })
    .limit(1);
  assert(!kur.error, `  Kurlar sorgu hatasız`);
  assert((kur.data?.length ?? 0) > 0, `  Kurlar data > 0 (${kur.data?.length})`);

  await anonClient.auth.signOut();
}

// ════════════════════════════════════════════════
// TEST 4: Farklı Roller ile Erişim
// ════════════════════════════════════════════════
async function testDifferentRoles() {
  console.log("\n═══ TEST 4: Rol Bazlı Erişim Testi ═══\n");

  const testUsers = [
    { email: "sinan@vigowood.com", expectedRole: "Yönetici" },
    { email: "berat@vigowood.com", expectedRole: "Sevkiyat Sorumlusu" },
    { email: "kesim@vigowood.com", expectedRole: "Üretim" },
  ];

  for (const tu of testUsers) {
    console.log(`  👤 ${tu.email}`);
    const token = await signIn(tu.email);
    if (!token) {
      console.log(`  ⚠️ Giriş başarısız, atlanıyor`);
      failed++;
      continue;
    }

    const c = makeAuthClient(token);

    // Rol kontrolü
    const {
      data: { user: authUser },
    } = await c.auth.getUser();
    const { data: dbUser } = await c
      .from("users")
      .select("role")
      .eq("auth_id", authUser!.id)
      .single();
    const role = dbUser?.role ?? "bilinmiyor";
    console.log(`     Rol: ${role}`);

    // Kritik tablo testi
    const { count: sablonCount } = await c
      .from("sevkiyat_palet_sablon")
      .select("*", { count: "exact", head: true });
    assert((sablonCount ?? 0) > 0, `  ${role}: sablonlar erişim (${sablonCount})`);

    const { count: fiyatCount } = await c
      .from("sevkiyat_fiyatlar")
      .select("*", { count: "exact", head: true });
    assert((fiyatCount ?? 0) > 0, `  ${role}: fiyatlar erişim (${fiyatCount})`);

    const { count: productCount } = await c
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("aktif_mi", true);
    assert((productCount ?? 0) > 0, `  ${role}: products erişim (${productCount})`);

    const { count: maliyetCount } = await c
      .from("sevkiyat_maliyetler")
      .select("*", { count: "exact", head: true });
    if (["Yönetici", "Endüstri Mühendisi"].includes(role)) {
      assert((maliyetCount ?? 0) > 0, `  ${role}: maliyetler erişim (${maliyetCount})`);
    } else {
      assert(maliyetCount === 0, `  ${role}: maliyetler ENGELLENMELİ (${maliyetCount})`);
    }

    await anonClient.auth.signOut();
    console.log("");
  }
}

// ════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════
async function main() {
  console.log("🔍 VigoWood — Kapsamlı RLS & Tablo Erişim Testi\n");
  console.log("=" .repeat(50));

  const serviceCounts = await testServiceRoleCounts();
  await testAuthenticatedRLS(serviceCounts);
  await testPageQueries();
  await testDifferentRoles();

  // Sonuç
  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 SONUÇ: ${passed} geçti, ${failed} başarısız\n`);

  if (failed > 0) {
    console.log("🚨 Başarısız testler var! Yukarıdaki ❌ satırlarını kontrol edin.\n");
    process.exit(1);
  } else {
    console.log("✅ Tüm testler geçti! Veri mevcut ve erişim doğru.\n");
    console.log("ℹ️  Eğer UI'da hala boş görünüyorsa:");
    console.log("   1. Tarayıcıda çıkış yap ve tekrar giriş yap");
    console.log("   2. Hard refresh: Ctrl+Shift+R");
    console.log("   3. Vercel deployment'ın tamamlandığından emin ol");
    console.log("   4. Tarayıcı DevTools > Network tabında hata var mı kontrol et\n");
  }
}

main().catch(console.error);
