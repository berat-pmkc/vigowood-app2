/**
 * Seed script: Update Supabase Auth passwords for all users with email
 * Password pattern: FirstName2026.
 *
 * Usage: npx tsx supabase/seed-user-passwords.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Fetch all users with email from users table
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("user_id, email, full_name, auth_id, password_plain")
    .not("email", "is", null)
    .order("user_id");

  if (usersErr) {
    console.error("Failed to fetch users:", usersErr.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users with email\n`);

  let updated = 0;
  let created = 0;
  let failed = 0;

  for (const user of users) {
    const password = user.password_plain || user.full_name.split(" ")[0] + "2026.";
    console.log(`${user.user_id} | ${user.email} | ${password}`);

    if (user.auth_id) {
      // User already has auth account — update password
      const { error } = await supabase.auth.admin.updateUserById(user.auth_id, {
        password,
      });

      if (error) {
        console.error(`  FAILED to update auth for ${user.user_id}: ${error.message}`);
        failed++;
      } else {
        console.log(`  Updated auth password`);
        updated++;
      }
    } else {
      // User has email but no auth account — create one
      const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
        email: user.email!,
        password,
        email_confirm: true,
      });

      if (createErr) {
        console.error(`  FAILED to create auth for ${user.user_id}: ${createErr.message}`);
        failed++;
      } else if (authData.user) {
        // Link auth_id to users table
        const { error: linkErr } = await supabase
          .from("users")
          .update({ auth_id: authData.user.id })
          .eq("user_id", user.user_id);

        if (linkErr) {
          console.error(`  Auth created but FAILED to link: ${linkErr.message}`);
        } else {
          console.log(`  Created auth + linked`);
        }
        created++;
      }
    }
  }

  console.log(`\nDone: ${updated} updated, ${created} created, ${failed} failed`);
}

main().catch(console.error);
