/**
 * Diagnostic page — OUTSIDE dashboard layout
 * Tests multiple Supabase query approaches to isolate the empty-data bug.
 * Accessible at /diag (no auth required for debugging)
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Force fully dynamic rendering, no caching whatsoever
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface TestResult {
  label: string;
  dataLength: number | null;
  count: number | null;
  error: string | null;
  firstSku: string | null;
  status?: number;
  contentRange?: string | null;
  bodyPreview?: string | null;
}

export default async function DiagPage() {
  const results: TestResult[] = [];
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Get auth cookies for raw fetch
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join("; ");

  // Find the access token from cookies
  const sbAccessToken = allCookies.find(c => c.name.includes("auth-token"))?.value;
  // Parse the auth token - it might be a base64 chunk
  let accessToken = "";
  try {
    // Supabase stores auth as chunked cookies: sb-xxx-auth-token.0, sb-xxx-auth-token.1, etc.
    const tokenChunks = allCookies
      .filter(c => c.name.includes("auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => c.value);
    if (tokenChunks.length > 0) {
      const combined = tokenChunks.join("");
      const parsed = JSON.parse(decodeURIComponent(combined));
      accessToken = parsed.access_token || parsed?.token?.access_token || "";
    }
  } catch {
    // Try direct base64 decode
    try {
      const tokenChunks = allCookies
        .filter(c => c.name.includes("auth-token"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => c.value);
      const combined = tokenChunks.join("");
      const decoded = Buffer.from(combined, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      accessToken = parsed.access_token || "";
    } catch {
      accessToken = "[could not extract]";
    }
  }

  // ═══════════════════════════════════════════════════
  // TEST 1: Raw fetch to PostgREST (bypass Supabase client entirely)
  // ═══════════════════════════════════════════════════
  try {
    const url = `${supabaseUrl}/rest/v1/products?select=sku,urun_adi&order=sku.asc&limit=5`;
    const res = await fetch(url, {
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${accessToken || supabaseAnonKey}`,
        "Content-Type": "application/json",
        "Prefer": "count=exact",
        "Range": "0-4",
      },
      cache: "no-store",
    });
    const contentRange = res.headers.get("content-range");
    const bodyText = await res.text();
    let data: unknown[] = [];
    try { data = JSON.parse(bodyText); } catch { /* */ }
    results.push({
      label: "1. Raw fetch (no Supabase client)",
      dataLength: Array.isArray(data) ? data.length : null,
      count: contentRange ? parseInt(contentRange.split("/")[1]) : null,
      error: res.ok ? null : `HTTP ${res.status}`,
      firstSku: Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, string>).sku : null,
      status: res.status,
      contentRange,
      bodyPreview: bodyText.slice(0, 200),
    });
  } catch (e) {
    results.push({
      label: "1. Raw fetch (no Supabase client)",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 2: Raw fetch with service role key (bypass RLS)
  // ═══════════════════════════════════════════════════
  if (supabaseServiceKey) {
    try {
      const url = `${supabaseUrl}/rest/v1/products?select=sku,urun_adi&order=sku.asc&limit=5`;
      const res = await fetch(url, {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          "Prefer": "count=exact",
          "Range": "0-4",
        },
        cache: "no-store",
      });
      const contentRange = res.headers.get("content-range");
      const bodyText = await res.text();
      let data: unknown[] = [];
      try { data = JSON.parse(bodyText); } catch { /* */ }
      results.push({
        label: "2. Raw fetch + service role (bypass RLS)",
        dataLength: Array.isArray(data) ? data.length : null,
        count: contentRange ? parseInt(contentRange.split("/")[1]) : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        firstSku: Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, string>).sku : null,
        status: res.status,
        contentRange,
        bodyPreview: bodyText.slice(0, 200),
      });
    } catch (e) {
      results.push({
        label: "2. Raw fetch + service role (bypass RLS)",
        dataLength: null, count: null,
        error: String(e),
        firstSku: null,
      });
    }
  } else {
    results.push({
      label: "2. Raw fetch + service role (bypass RLS)",
      dataLength: null, count: null,
      error: "SUPABASE_SERVICE_ROLE_KEY not set",
      firstSku: null,
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 3: Supabase client WITHOUT global fetch override
  // ═══════════════════════════════════════════════════
  try {
    const client3 = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* */ }
          },
        },
        // NO global.fetch override
      }
    );
    const r = await client3
      .from("products")
      .select("sku, urun_adi", { count: "exact" })
      .order("sku", { ascending: true })
      .range(0, 4);
    results.push({
      label: "3. Supabase client (NO fetch override)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "3. Supabase client (NO fetch override)",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 4: Supabase client WITH cache:no-store override
  // ═══════════════════════════════════════════════════
  try {
    const client4 = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* */ }
          },
        },
        global: {
          fetch: (input, init) => {
            return fetch(input, { ...init, cache: "no-store" });
          },
        },
      }
    );
    const r = await client4
      .from("products")
      .select("sku, urun_adi", { count: "exact" })
      .order("sku", { ascending: true })
      .range(0, 4);
    results.push({
      label: "4. Supabase client (cache:no-store override)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "4. Supabase client (cache:no-store override)",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 5: Supabase client with unique cache-buster in fetch
  // ═══════════════════════════════════════════════════
  try {
    const client5 = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* */ }
          },
        },
        global: {
          fetch: (input, init) => {
            // Add unique nonce to prevent React fetch deduplication
            const url = typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input instanceof Request
                  ? input.url
                  : String(input);
            const sep = url.includes("?") ? "&" : "?";
            const nonce = `_nc=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            return fetch(`${url}${sep}${nonce}`, { ...init, cache: "no-store" });
          },
        },
      }
    );
    const r = await client5
      .from("products")
      .select("sku, urun_adi", { count: "exact" })
      .order("sku", { ascending: true })
      .range(0, 4);
    results.push({
      label: "5. Supabase client (cache-buster nonce)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "5. Supabase client (cache-buster nonce)",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 6: Supabase client with intercepted response logging
  // ═══════════════════════════════════════════════════
  let interceptedInfo = "";
  try {
    const client6 = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* */ }
          },
        },
        global: {
          fetch: async (input, init) => {
            const res = await fetch(input, { ...init, cache: "no-store" });
            // Clone the response to read body without consuming it
            const cloned = res.clone();
            const body = await cloned.text();
            const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
            if (url.includes("/rest/v1/products")) {
              interceptedInfo = JSON.stringify({
                url: url.slice(0, 100),
                status: res.status,
                contentRange: res.headers.get("content-range"),
                contentType: res.headers.get("content-type"),
                bodyLength: body.length,
                bodyPreview: body.slice(0, 300),
                bodyIsArray: body.startsWith("["),
              });
            }
            // Return original (un-consumed) response
            return res;
          },
        },
      }
    );
    const r = await client6
      .from("products")
      .select("sku, urun_adi", { count: "exact" })
      .order("sku", { ascending: true })
      .range(0, 4);
    results.push({
      label: "6. Intercepted fetch (clone + log body)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
      bodyPreview: interceptedInfo || "no interception happened",
    });
  } catch (e) {
    results.push({
      label: "6. Intercepted fetch (clone + log body)",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
      bodyPreview: interceptedInfo || "error before interception",
    });
  }

  // ═══════════════════════════════════════════════════
  // TEST 7: Use the standard createClient from server.ts
  // ═══════════════════════════════════════════════════
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const client7 = await createClient();
    const r = await client7
      .from("products")
      .select("sku, urun_adi", { count: "exact" })
      .order("sku", { ascending: true })
      .range(0, 4);
    results.push({
      label: "7. Standard createClient() from server.ts",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "7. Standard createClient() from server.ts",
      dataLength: null, count: null,
      error: String(e),
      firstSku: null,
    });
  }

  // Auth info
  const authCookieNames = allCookies
    .filter(c => c.name.includes("auth") || c.name.includes("sb-"))
    .map(c => `${c.name} (${c.value.length} chars)`);

  return (
    <div className="p-6 font-mono text-xs max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold mb-4">Supabase Query Diagnostic</h1>
      <p className="text-gray-500">
        Outside dashboard layout | dynamic=force-dynamic | fetchCache=force-no-store
      </p>

      <div className="p-3 rounded border bg-gray-100">
        <strong>Auth Cookies:</strong>
        <pre className="whitespace-pre-wrap">{authCookieNames.join("\n") || "NONE"}</pre>
        <strong>Access Token:</strong> {accessToken ? `${accessToken.slice(0, 20)}...` : "NOT FOUND"}
      </div>

      {results.map((r, i) => {
        const isOk = r.dataLength !== null && r.dataLength > 0;
        const bgColor = r.error
          ? "bg-red-50 border-red-300"
          : isOk
            ? "bg-green-50 border-green-300"
            : "bg-yellow-50 border-yellow-300";
        return (
          <div key={i} className={`p-3 rounded border ${bgColor}`}>
            <strong>{r.label}</strong>
            <p>
              data: <b>{r.dataLength ?? "NULL"}</b> |
              count: <b>{r.count ?? "NULL"}</b> |
              error: <b>{r.error ?? "none"}</b> |
              firstSku: <b>{r.firstSku ?? "EMPTY"}</b>
            </p>
            {r.status !== undefined && <p>HTTP status: {r.status}</p>}
            {r.contentRange && <p>Content-Range: {r.contentRange}</p>}
            {r.bodyPreview && (
              <details className="mt-1">
                <summary className="cursor-pointer text-blue-600">Body preview</summary>
                <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-40 overflow-auto bg-white p-2 rounded">
                  {r.bodyPreview}
                </pre>
              </details>
            )}
          </div>
        );
      })}

      <div className="p-3 rounded border bg-gray-50 text-[10px]">
        <strong>Environment:</strong>
        <p>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl ? "set" : "MISSING"}</p>
        <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {supabaseAnonKey ? `${supabaseAnonKey.slice(0, 10)}...` : "MISSING"}</p>
        <p>SUPABASE_SERVICE_ROLE_KEY: {supabaseServiceKey ? "set" : "MISSING"}</p>
        <p>Timestamp: {new Date().toISOString()}</p>
      </div>
    </div>
  );
}
