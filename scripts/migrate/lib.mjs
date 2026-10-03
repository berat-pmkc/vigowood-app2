// Shared helpers for the VigoWood schema migration scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const OUT_DIR = path.join(__dirname, 'out');
export const SOURCE_REF = 'mdxaktebpuhlwacqcven';
export const SOURCE_SCHEMA = 'public';
export const API = 'https://api.supabase.com';

// ---------- logging / masking ----------
const secrets = new Set();
export function mask(s) {
  let out = String(s ?? '');
  for (const v of secrets) if (v && v.length >= 6) out = out.split(v).join('***');
  return out;
}
export const log = (...a) => console.log(...a.map((x) => (typeof x === 'string' ? mask(x) : x)));
export const warn = (...a) => console.warn('WARN:', ...a.map((x) => (typeof x === 'string' ? mask(x) : x)));
export function die(msg, code = 1) {
  console.error('ERROR: ' + mask(msg));
  process.exit(code);
}

// ---------- env ----------
export function loadEnv(file = path.join(REPO_ROOT, 'supabase', '.env.migration.local')) {
  const env = {};
  if (!fs.existsSync(file)) die(`Env file not found: ${file}`);
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.includes('"', 1)) || (v.startsWith("'") && v.includes("'", 1))) {
      const q = v[0];
      v = v.slice(1, v.indexOf(q, 1));
    } else {
      v = v.replace(/\s+#.*$/, '').trim();
    }
    env[m[1]] = v;
  }
  for (const k of ['SUPABASE_ACCESS_TOKEN', 'TARGET_SECRET_KEY', 'TARGET_PUBLISHABLE_KEY', 'SOURCE_ACCESS_TOKEN'])
    if (env[k]) secrets.add(env[k]);
  return env;
}

export function requireEnv(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) die(`Missing env keys in supabase/.env.migration.local: ${missing.join(', ')}`);
}

// ---------- args ----------
export function parseArgs(argv = process.argv.slice(2)) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split('=');
      if (v !== undefined) a[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) a[k] = argv[++i];
      else a[k] = true;
    } else a._.push(t);
  }
  return a;
}

// ---------- schema guard ----------
export function guardSchema(name) {
  if (typeof name !== 'string' || !/^vigowood[a-z0-9_]*$/.test(name))
    die(`Refusing schema "${name}": name must match ^vigowood[a-z0-9_]*$ (never public/numo/auth/storage/...).`);
  return name;
}
export const bucketIds = (schema) => ({
  'task-attachments': `${schema}-task-attachments`,
  'user-avatars': `${schema}-user-avatars`,
});

// ---------- sql literal helpers ----------
export const qi = (id) => '"' + String(id).replace(/"/g, '""') + '"';
export const ql = (s) => (s === null || s === undefined ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");

// ---------- excluded (non-migrated) tables ----------
export const EXCLUDED_EXACT = new Set([
  'satis_raporlari', 'satis_satirlari', 'tr_pazarlama', 'kampanyalar', 'dia_sync_log',
  'sku_mappings', 'daily_summary', 'weekly_sku_summary', 'monthly_sku_summary',
  'marketplaces', 'shipping_providers', 'marketplace_shipping', 'product_target_prices',
  'product_box_dimensions', 'marketplace_listings', 'pricing_snapshots',
]);
export const EXCLUDED_PREFIX = ['trendyol_', 'ikas_'];
export const isExcluded = (t) => EXCLUDED_EXACT.has(t) || EXCLUDED_PREFIX.some((p) => t.startsWith(p));

// ---------- Management API ----------
async function request(method, url, token, body, label) {
  const delays = [1000, 3000, 8000, 20000, 45000];
  let lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    let res, text;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      text = await res.text();
    } catch (e) {
      lastErr = new Error(`${label || url}: network error ${e.message}`);
      if (attempt < delays.length) { await sleep(delays[attempt]); continue; }
      throw lastErr;
    }
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (res.ok) return json;
    const msg = typeof json === 'object' && json ? (json.message || json.error || JSON.stringify(json)) : String(json);
    lastErr = new Error(`${label || url}: HTTP ${res.status} ${mask(msg).slice(0, 4000)}`);
    lastErr.status = res.status;
    if ((res.status === 429 || res.status >= 500) && attempt < delays.length) {
      await sleep(delays[attempt]);
      continue;
    }
    throw lastErr;
  }
  throw lastErr;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run SQL via Management API. Returns array of rows (last statement's result). */
export function sql(ref, token, query, { readOnly = false, label } = {}) {
  const body = { query };
  if (readOnly) body.read_only = true;
  return request('POST', `${API}/v1/projects/${ref}/database/query`, token, body, label || `sql@${ref}`);
}
export function mgmt(method, pathname, token, body, label) {
  return request(method, `${API}${pathname}`, token, body, label || `${method} ${pathname}`);
}

/** Convenience context for scripts. */
export function context() {
  const env = loadEnv();
  const ctx = {
    env,
    targetRef: env.TARGET_PROJECT_REF,
    targetUrl: env.TARGET_PROJECT_REF ? `https://${env.TARGET_PROJECT_REF}.supabase.co` : undefined,
  };
  ctx.tgt = (q, o) => {
    requireEnv(env, ['TARGET_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']);
    return sql(env.TARGET_PROJECT_REF, env.SUPABASE_ACCESS_TOKEN, q, o);
  };
  ctx.src = (q, o = {}) => {
    requireEnv(env, ['SOURCE_ACCESS_TOKEN']);
    return sql(SOURCE_REF, env.SOURCE_ACCESS_TOKEN, q, { ...o, readOnly: true });
  };
  ctx.tgtMgmt = (m, p, b) => { requireEnv(env, ['SUPABASE_ACCESS_TOKEN']); return mgmt(m, p, env.SUPABASE_ACCESS_TOKEN, b); };
  return ctx;
}

export function ensureOut(...parts) {
  const d = path.join(OUT_DIR, ...parts);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function table(rows, cols) {
  if (!rows.length) return '(none)';
  cols = cols || Object.keys(rows[0]);
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (r) => cols.map((c, i) => String(r[c] ?? '').padEnd(w[i])).join('  ');
  return [line(Object.fromEntries(cols.map((c) => [c, c]))), w.map((x) => '-'.repeat(x)).join('  '), ...rows.map(line)].join('\n');
}
