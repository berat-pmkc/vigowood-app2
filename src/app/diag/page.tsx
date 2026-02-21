/**
 * Diagnostic page — OUTSIDE dashboard layout
 * Tests the rawFetch (node:https) approach vs patched global fetch.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { request as httpsRequest } from "node:https";

export const dynamic = "force-dynamic";

interface TestResult {
  label: string;
  dataLength: number | null;
  count: number | null;
  error: string | null;
  firstSku: string | null;
  bodyPreview?: string | null;
}

/** Same rawFetch as server.ts — bypasses Next.js patch-fetch */
function rawFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.href;
    else if (input instanceof Request) url = input.url;
    else url = String(input);
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = {};
    const initHeaders = init?.headers;
    if (initHeaders) {
      if (initHeaders instanceof Headers) {
        initHeaders.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(initHeaders)) {
        initHeaders.forEach(([k, v]) => { headers[k] = String(v); });
      } else {
        Object.entries(initHeaders as Record<string, string>).forEach(([k, v]) => {
          if (v !== undefined) headers[k] = String(v);
        });
      }
    }
    const req = httpsRequest({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port) : 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: init?.method || "GET",
      headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const responseHeaders = new Headers();
        Object.entries(res.headers).forEach(([k, v]) => {
          if (k && v) {
            if (Array.isArray(v)) v.forEach(val => responseHeaders.append(k, val));
            else responseHeaders.set(k, v);
          }
        });
        resolve(new Response(body, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || "",
          headers: responseHeaders,
        }));
      });
    });
    req.on("error", reject);
    if (init?.body) {
      if (typeof init.body === "string") req.write(init.body);
      else if (init.body instanceof ArrayBuffer) req.write(Buffer.from(init.body));
      else if (Buffer.isBuffer(init.body)) req.write(init.body);
    }
    req.end();
  });
}

export default async function DiagPage() {
  const results: TestResult[] = [];
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // ===== TEST 1: rawFetch (node:https) directly to PostgREST =====
  try {
    const url = `${supabaseUrl}/rest/v1/products?select=sku,urun_adi&order=sku.asc&limit=5`;
    const res = await rawFetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
        Range: "0-4",
      },
    });
    const contentRange = res.headers.get("content-range");
    const bodyText = await res.text();
    let data: unknown[] = [];
    try { data = JSON.parse(bodyText); } catch { /* */ }
    results.push({
      label: "1. rawFetch (node:https) — direct PostgREST",
      dataLength: Array.isArray(data) ? data.length : null,
      count: contentRange ? parseInt(contentRange.split("/")[1]) : null,
      error: res.ok ? null : `HTTP ${res.status}`,
      firstSku: Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, string>).sku : null,
      bodyPreview: bodyText.slice(0, 200),
    });
  } catch (e) {
    results.push({
      label: "1. rawFetch (node:https) — direct PostgREST",
      dataLength: null, count: null, error: String(e), firstSku: null,
    });
  }

  // ===== TEST 2: Supabase client with rawFetch (same as new server.ts) =====
  try {
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* */ }
        },
      },
      global: { fetch: rawFetch as unknown as typeof globalThis.fetch },
    });
    const r = await client.from("products").select("sku, urun_adi", { count: "exact" }).order("sku", { ascending: true }).range(0, 4);
    results.push({
      label: "2. Supabase client + rawFetch (node:https)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "2. Supabase client + rawFetch (node:https)",
      dataLength: null, count: null, error: String(e), firstSku: null,
    });
  }

  // ===== TEST 3: Standard createClient from server.ts (uses rawFetch now) =====
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const client = await createClient();
    const r = await client.from("products").select("sku, urun_adi", { count: "exact" }).order("sku", { ascending: true }).range(0, 4);
    results.push({
      label: "3. createClient() from server.ts (production path)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "3. createClient() from server.ts (production path)",
      dataLength: null, count: null, error: String(e), firstSku: null,
    });
  }

  // ===== TEST 4: Patched global fetch (for comparison — should FAIL) =====
  try {
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* */ }
        },
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
    const r = await client.from("products").select("sku, urun_adi", { count: "exact" }).order("sku", { ascending: true }).range(0, 4);
    results.push({
      label: "4. Patched global fetch (expected to fail)",
      dataLength: r.data?.length ?? null,
      count: r.count,
      error: r.error?.message ?? null,
      firstSku: r.data?.[0]?.sku ?? null,
    });
  } catch (e) {
    results.push({
      label: "4. Patched global fetch (expected to fail)",
      dataLength: null, count: null, error: String(e), firstSku: null,
    });
  }

  return (
    <div className="p-6 font-mono text-xs max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold mb-4">Supabase Fetch Diagnostic</h1>
      <p className="text-gray-500 mb-4">
        Tests 1-3 use node:https (bypasses Next.js patch-fetch).
        Test 4 uses patched global fetch (expected to show the bug).
      </p>

      {results.map((r, i) => {
        const isOk = r.dataLength !== null && r.dataLength > 0;
        const bgColor = r.error
          ? "bg-red-100 border-red-400"
          : isOk
            ? "bg-green-100 border-green-400"
            : "bg-yellow-100 border-yellow-400";
        return (
          <div key={i} className={`p-4 rounded border-2 ${bgColor}`}>
            <strong className="text-sm">{r.label}</strong>
            <p className="mt-1">
              data: <b className={isOk ? "text-green-700" : "text-red-700"}>{r.dataLength ?? "NULL"}</b> |
              count: <b>{r.count ?? "NULL"}</b> |
              error: <b>{r.error ?? "none"}</b> |
              firstSku: <b>{r.firstSku ?? "EMPTY"}</b>
            </p>
            {r.bodyPreview && (
              <details className="mt-1">
                <summary className="cursor-pointer text-blue-600 text-[10px]">Body</summary>
                <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-auto bg-white/70 p-1 rounded">
                  {r.bodyPreview}
                </pre>
              </details>
            )}
          </div>
        );
      })}

      <div className="p-3 rounded border bg-gray-100 text-[10px]">
        <p>Timestamp: {new Date().toISOString()}</p>
        <p>SUPABASE_URL: {supabaseUrl ? "set" : "MISSING"}</p>
      </div>
    </div>
  );
}
