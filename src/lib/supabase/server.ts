import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { request as httpsRequest } from "node:https";
import type { Database } from "./types";

/**
 * Raw HTTPS fetch that bypasses Next.js's patched global.fetch.
 *
 * Next.js 16 patches globalThis.fetch in Server Components for caching
 * and deduplication. This patch consumes the response body stream,
 * causing Supabase queries to return { data: null, count: N } —
 * the count (from Content-Range header) works but data (from body) is empty.
 *
 * This function uses Node.js's native https module directly,
 * completely bypassing the patched fetch pipeline.
 *
 * See: vercel/next.js#73035, vercel/next.js#69635
 */
function rawFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Extract URL string
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.href;
    else if (input instanceof Request) url = input.url;
    else url = String(input);

    const parsedUrl = new URL(url);

    // Extract headers into plain object
    const headers: Record<string, string> = {};
    const initHeaders = init?.headers;
    if (initHeaders) {
      if (initHeaders instanceof Headers) {
        initHeaders.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(initHeaders)) {
        initHeaders.forEach(([key, value]) => {
          headers[key] = String(value);
        });
      } else {
        Object.entries(initHeaders as Record<string, string>).forEach(
          ([key, value]) => {
            if (value !== undefined) headers[key] = String(value);
          }
        );
      }
    }

    const req = httpsRequest(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? parseInt(parsedUrl.port) : 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: init?.method || "GET",
        headers,
        signal: init?.signal as AbortSignal | undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          Object.entries(res.headers).forEach(([key, value]) => {
            if (key && value) {
              if (Array.isArray(value)) {
                value.forEach((v) => responseHeaders.append(key, v));
              } else {
                responseHeaders.set(key, value);
              }
            }
          });
          resolve(
            new Response(body, {
              status: res.statusCode || 200,
              statusText: res.statusMessage || "",
              headers: responseHeaders,
            })
          );
        });
      }
    );

    req.on("error", reject);

    // Handle request body for POST/PATCH/PUT/DELETE
    if (init?.body) {
      if (typeof init.body === "string") {
        req.write(init.body);
      } else if (init.body instanceof ArrayBuffer) {
        req.write(Buffer.from(init.body));
      } else if (init.body instanceof Uint8Array) {
        req.write(Buffer.from(init.body));
      } else if (Buffer.isBuffer(init.body)) {
        req.write(init.body);
      } else {
        // Fallback: stringify for objects
        req.write(String(init.body));
      }
    }

    req.end();
  });
}

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
        fetch: rawFetch as unknown as typeof globalThis.fetch,
      },
    }
  );
}
