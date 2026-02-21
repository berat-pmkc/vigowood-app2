import { createClient } from "@/lib/supabase/server";

export default async function TestQueryPage() {
  const supabase = await createClient();

  // Test A: Pure chain - simplest possible
  const a = await supabase
    .from("products")
    .select("sku, urun_adi", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 4);

  // Test B: Same but select("*")
  const b = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 4);

  // Test C: With variable (like original pattern)
  const sortColumn = "sku";
  const sortOrder = true;
  const from = 0;
  const to = 4;
  const c = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order(sortColumn, { ascending: sortOrder })
    .range(from, to);

  // Test D: let query pattern (the suspected problem)
  let query = supabase
    .from("products")
    .select("*", { count: "exact" });
  query = query.order("sku", { ascending: true });
  query = query.range(0, 4);
  const d = await query;

  // Test E: let query with variable params
  let query2 = supabase
    .from("products")
    .select("*", { count: "exact" });
  query2 = query2.order(sortColumn, { ascending: sortOrder });
  query2 = query2.range(from, to);
  const e = await query2;

  return (
    <div className="p-6 font-mono text-xs space-y-4">
      <h1 className="text-lg font-bold">Query Pattern Test</h1>
      <div className="p-3 rounded border bg-blue-50">
        <strong>A: Pure chain select specific cols</strong>
        <p>length: {a.data?.length ?? "NULL"} | count: {a.count} | error: {a.error?.message ?? "none"}</p>
        <p>first: {a.data?.[0] ? JSON.stringify(a.data[0]) : "EMPTY"}</p>
      </div>
      <div className="p-3 rounded border bg-green-50">
        <strong>B: Pure chain select *</strong>
        <p>length: {b.data?.length ?? "NULL"} | count: {b.count} | error: {b.error?.message ?? "none"}</p>
        <p>first sku: {b.data?.[0] ? (b.data[0] as Record<string, unknown>).sku as string : "EMPTY"}</p>
      </div>
      <div className="p-3 rounded border bg-yellow-50">
        <strong>C: Chain with variable params</strong>
        <p>length: {c.data?.length ?? "NULL"} | count: {c.count} | error: {c.error?.message ?? "none"}</p>
        <p>first sku: {c.data?.[0] ? (c.data[0] as Record<string, unknown>).sku as string : "EMPTY"}</p>
      </div>
      <div className="p-3 rounded border bg-red-50">
        <strong>D: let query pattern (literal params)</strong>
        <p>length: {d.data?.length ?? "NULL"} | count: {d.count} | error: {d.error?.message ?? "none"}</p>
        <p>first sku: {d.data?.[0] ? (d.data[0] as Record<string, unknown>).sku as string : "EMPTY"}</p>
      </div>
      <div className="p-3 rounded border bg-purple-50">
        <strong>E: let query pattern (variable params)</strong>
        <p>length: {e.data?.length ?? "NULL"} | count: {e.count} | error: {e.error?.message ?? "none"}</p>
        <p>first sku: {e.data?.[0] ? (e.data[0] as Record<string, unknown>).sku as string : "EMPTY"}</p>
      </div>
    </div>
  );
}
