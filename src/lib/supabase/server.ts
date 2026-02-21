import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
      global: {
        fetch: (input, init) => {
          // Unique header per request to prevent React Server Component
          // fetch deduplication which consumes the response body stream.
          // See: vercel/next.js#73035, vercel/next.js#69635
          const headers = new Headers(init?.headers as HeadersInit | undefined);
          headers.set(
            "x-supabase-nonce",
            `${Date.now()}-${Math.random().toString(36).slice(2)}`
          );
          return fetch(input, { ...init, headers, cache: "no-store" });
        },
      },
    }
  );
}
