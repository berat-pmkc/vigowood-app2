#!/usr/bin/env node
// Link <schema>.users to TARGET auth.users (match by email, create the missing ones). Never alters existing auth users.
// Usage: node scripts/migrate/auth-merge.mjs --schema vigowood_prova [--yes]      (without --yes: prints the plan only)
//        node scripts/migrate/auth-merge.mjs --schema vigowood_prova --rollback --yes
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, guardSchema, context, requireEnv, log, warn, die, ql, qi, table, mask, ensureOut } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();
requireEnv(ctx.env, ['TARGET_PROJECT_REF', 'TARGET_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN']);
const KEY = ctx.env.TARGET_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const reportFile = path.join(ensureOut(), `auth-merge-report.${schema}.json`);

async function gotrue(method, p, body) {
  const res = await fetch(`${ctx.targetUrl}/auth/v1/admin${p}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let j; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  if (!res.ok) throw new Error(`GoTrue ${method} ${p}: HTTP ${res.status} ${mask(typeof j === 'object' ? (j?.msg || j?.message || JSON.stringify(j)) : j).slice(0, 300)}`);
  return j;
}

// ---------------- rollback ----------------
if (args.rollback) {
  if (!fs.existsSync(reportFile)) die(`No report at ${reportFile}`);
  const rep = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  log(`Will delete ${rep.created.length} auth user(s) created by the previous run (existing users are never touched).`);
  if (!args.yes) die('Dry run. Re-run with --yes.', 2);
  for (const c of rep.created) {
    try { await gotrue('DELETE', `/users/${c.auth_id}`); log(`  deleted ${c.email}`); }
    catch (e) { warn(`${c.email}: ${e.message}`); }
  }
  const ids = rep.created.map((c) => ql(c.auth_id)).join(',');
  if (ids) await ctx.tgt(`set session_replication_role = replica; update ${qi(schema)}.users set auth_id = null where auth_id in (${ids});`);
  log('Rollback complete (users.auth_id for those accounts reset to null).');
  process.exit(0);
}

// ---------------- read state ----------------
const authByEmail = new Map();
for (let page = 1; ; page++) {
  const r = await gotrue('GET', `/users?page=${page}&per_page=1000`);
  const list = r.users || [];
  for (const u of list) if (u.email) authByEmail.set(u.email.trim().toLowerCase(), u.id);
  if (list.length < 1000) break;
}
log(`Target auth users (read-only): ${authByEmail.size}`);

const RENAME = { user_id: 'VW009', email: 'muhammet@vigowood.com', full_name: 'Muhammet Çılgın', role: 'Üretim ve Planlama Sorumlusu' };
const rename = `update ${qi(schema)}.users set email = ${ql(RENAME.email)}, full_name = ${ql(RENAME.full_name)}, role = ${ql(RENAME.role)} where user_id = ${ql(RENAME.user_id)}`;

const readUsers = () => ctx.tgt(
  `select user_id, email, full_name, role::text as role, password_plain, coalesce(is_active, true) as is_active, auth_id::text as old_auth_id
   from ${qi(schema)}.users order by user_id`, { readOnly: true });
let users = await readUsers();
// apply rename virtually for planning
users = users.map((u) => (u.user_id === RENAME.user_id ? { ...u, email: RENAME.email, full_name: RENAME.full_name, role: RENAME.role } : u));

const firstName = (n) => (String(n || 'User').trim().split(/\s+/)[0] || 'User');
const plan = [];
const usedAuth = new Set();
for (const u of users) {
  const email = (u.email || '').trim().toLowerCase();
  let action, aid = null;
  if (!email) action = 'skipped (no email)';
  else if (authByEmail.has(email)) {
    aid = authByEmail.get(email);
    if (usedAuth.has(aid)) { action = 'skipped (duplicate email)'; aid = null; } else action = 'matched';
  } else if (!u.is_active) action = 'skipped (inactive)';
  else action = 'create';
  if (aid) usedAuth.add(aid);
  plan.push({ user_id: u.user_id, email: email || '-', role: u.role, action, _u: u, _aid: aid });
}
log(table(plan.map(({ user_id, email, role, action }) => ({ user_id, email, role, action }))));
const cnt = (a) => plan.filter((p) => p.action === a).length;
log(`\nmatched: ${cnt('matched')}  to create: ${cnt('create')}  skipped: ${plan.length - cnt('matched') - cnt('create')}`);
if (!args.yes) die('Plan only (nothing changed). Re-run with --yes to apply (also applies the VW009 rename).', 2);

// ---------------- apply ----------------
await ctx.tgt(rename + ';', { label: 'VW009 rename' });
const created = [];
for (const p of plan) {
  if (p.action !== 'create') continue;
  const u = p._u;
  const password = u.password_plain || `${firstName(u.full_name)}2026.`;
  try {
    const r = await gotrue('POST', '/users', {
      email: p.email, password, email_confirm: true,
      user_metadata: { full_name: u.full_name, app: 'vigowood' },
    });
    p._aid = r.id; p.action = 'created';
    created.push({ user_id: u.user_id, email: p.email, auth_id: r.id });
    fs.writeFileSync(reportFile, JSON.stringify({ schema, at: new Date().toISOString(), created, idMap: {} }, null, 2)); // incremental, for rollback
  } catch (e) {
    p.action = 'FAILED';
    warn(`create ${p.email}: ${e.message}`);
  }
}

// old auth_id (from source data) -> new auth id
const idMap = {};
for (const p of plan) if (p._aid && p._u.old_auth_id && p._u.old_auth_id !== p._aid) idMap[p._u.old_auth_id] = p._aid;
const values = plan.filter((p) => p._aid).map((p) => `(${ql(p.user_id)}, ${ql(p._aid)}::uuid)`);
await ctx.tgt(
  `set session_replication_role = replica;\n` +
  `update ${qi(schema)}.users set auth_id = null;\n` +
  (values.length ? `update ${qi(schema)}.users u set auth_id = m.aid from (values ${values.join(',')}) as m(uid, aid) where u.user_id = m.uid;` : ''),
  { label: 'link auth_id' });

// remap other uuid columns that held old source auth ids (created_by, yukleyen_id, ...)
const oldIds = Object.keys(idMap);
if (oldIds.length) {
  const ucols = await ctx.tgt(
    `select c.table_name, c.column_name from information_schema.columns c
     join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
     where c.table_schema=${ql(schema)} and c.data_type='uuid' and c.table_name <> 'users'`, { readOnly: true });
  const mapValues = Object.entries(idMap).map(([o, n]) => `(${ql(o)}::uuid, ${ql(n)}::uuid)`).join(',');
  const oldList = oldIds.map((o) => ql(o) + '::uuid').join(',');
  for (const c of ucols) {
    const n = await ctx.tgt(`select count(*)::int as n from ${qi(schema)}.${qi(c.table_name)} where ${qi(c.column_name)} in (${oldList})`, { readOnly: true });
    if (!n[0].n) continue;
    await ctx.tgt(
      `set session_replication_role = replica;\nupdate ${qi(schema)}.${qi(c.table_name)} t set ${qi(c.column_name)} = m.nw from (values ${mapValues}) as m(od, nw) where t.${qi(c.column_name)} = m.od;`,
      { label: `remap ${c.table_name}.${c.column_name}` });
    log(`  remapped ${n[0].n} value(s) in ${c.table_name}.${c.column_name}`);
  }
}

fs.writeFileSync(reportFile, JSON.stringify({ schema, at: new Date().toISOString(), created, idMap }, null, 2));
log('\n' + table(plan.map(({ user_id, email, action }) => ({ user_id, email, action }))));
log(`\nReport (no passwords): ${path.relative(process.cwd(), reportFile)}`);
log('Also written as out/auth-merge-report.json copy for convenience.');
fs.copyFileSync(reportFile, path.join(ensureOut(), 'auth-merge-report.json'));
if (plan.some((p) => p.action === 'FAILED')) process.exit(4);
