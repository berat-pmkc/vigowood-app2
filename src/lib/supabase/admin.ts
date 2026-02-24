import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Admin client — only use in server-side code (API routes, server actions)
// Uses service_role key which bypasses RLS
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            keepalive: true,
          });
        },
      },
    }
  );
}
