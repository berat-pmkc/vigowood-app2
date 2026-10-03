import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { DB_SCHEMA } from "./schema";

export function createClient() {
  return createBrowserClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: DB_SCHEMA as "public" } }
  );
}
