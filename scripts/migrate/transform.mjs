// Pure SQL text transforms: rewrite a migration written for `public` so it builds into another schema.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, bucketIds } from './lib.mjs';

export function listMigrationFiles() {
  const mig = path.join(REPO_ROOT, 'supabase', 'migrations');
  const pend = path.join(REPO_ROOT, 'supabase', 'pending_migrations');
  const rd = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.sql')) : []);
  const num = (f) => parseInt(f.match(/^(\d+)_/)?.[1] ?? '0', 10);
  const isTs = (f) => /^\d{14}_/.test(f);
  const m = rd(mig);
  const short = m.filter((f) => !isTs(f)).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  const ts = m.filter(isTs).sort();
  const pending = rd(pend).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  return [
    ...[...short, ...ts].map((f) => ({ name: f, full: path.join(mig, f), kind: 'migrations' })),
    ...pending.map((f) => ({ name: f, full: path.join(pend, f), kind: 'pending' })),
  ];
}

export const header = (schema) => `set search_path = ${schema}, extensions;\n`; // `public` deliberately omitted: unqualified DROP/ALTER must never reach another app's objects
export const footer = '\nreset search_path;\n';

/**
 * @returns {{sql:string, notes:{skipped:string[], warnings:string[], leftoverPublic:string[]}}}
 */
export function transform(src, schema, fileLabel = '') {
  const notes = { skipped: [], warnings: [], leftoverPublic: [] };
  let s = src.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const buckets = bucketIds(schema);
  const SP = `${schema}, extensions`;

  // 1. Triggers on auth.* : skip (would affect the other app).
  s = s.replace(/(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER|DROP\s+TRIGGER)\b[^;]*?\bON\s+"?auth"?\.[^;]*;/gi, (m) => {
    notes.skipped.push(`TRIGGER ON auth.*: ${m.replace(/\s+/g, ' ').slice(0, 160)}`);
    return '-- SKIPPED (auth trigger): ' + m.replace(/\n/g, '\n-- ');
  });

  // 2. Extensions.
  s = s.replace(/EXECUTE\s+'CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron'\s*;/gi, () => {
    notes.skipped.push('EXECUTE CREATE EXTENSION pg_cron (already installed on target)');
    return 'NULL; -- pg_cron already installed on target';
  });
  s = s.replace(/(?<!['\w])CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([\w-]+)"?[^;'\n]*;/gi, (m, name) => {
    if (name.toLowerCase() === 'pg_cron') {
      notes.skipped.push('CREATE EXTENSION pg_cron');
      return 'SELECT 1; -- SKIPPED CREATE EXTENSION pg_cron';
    }
    return `CREATE EXTENSION IF NOT EXISTS "${name}" WITH SCHEMA extensions;`;
  });

  // 3. search_path settings (function attributes).
  s = s.replace(/search_path\s*(?:=|\bTO\b)\s*(?:'[^']*'|"[^"]*"|[\w]+(?:\s*,\s*[\w"]+)*)/gi, `search_path = ${SP}`);

  // 4. Catalog-query scoping.
  s = s.replace(/schemaname\s+IN\s*\(\s*'public'\s*,\s*'storage'\s*\)/gi, `schemaname = '${schema}'`);
  s = s.replace(/\(\?:public\\\.\)\?/g, `(?:${schema}\\.)?`); // regex text inside the policy-rewrite DO block
  s = s.replace(/FROM\s+pg_policies\s+WHERE\s+(?!schemaname)/gi, `FROM pg_policies WHERE schemaname = '${schema}' AND `);
  s = s.replace(/FROM\s+information_schema\.(table_constraints|tables|columns)\s+WHERE\s+(?!table_schema|constraint_schema)/gi,
    (m, t) => `FROM information_schema.${t} WHERE table_schema = '${schema}' AND `);
  s = s.replace(/table_schema\s*=\s*'public'/gi, `table_schema = '${schema}'`);
  s = s.replace(/(schemaname|nspname)\s*=\s*'public'/gi, `$1 = '${schema}'`);

  // 5. public. qualifier.
  s = s.replace(/(?<![\w$."])"public"\./gi, `${schema}.`);
  s = s.replace(/(?<![\w$."])public\./gi, `${schema}.`);

  // 6. cron job names.
  s = s.replace(/(cron\.(?:schedule|unschedule)\s*\(\s*)'([^']+)'/gi, (m, p, n) => `${p}'${schema}-${n}'`);
  s = s.replace(/(jobname\s*=\s*)'([^']+)'/gi, (m, p, n) => `${p}'${schema}-${n}'`);

  // 7. Storage: policies + bucket ids.
  s = s.replace(/((?:CREATE|ALTER)\s+POLICY\s+)"([^"]+)"(\s+ON\s+storage\.objects)/gi, (m, p, n, o) => {
    const pn = `${schema} ${n}`.replace(/"/g, '""');
    return p.toUpperCase().startsWith('CREATE')
      ? `DROP POLICY IF EXISTS "${pn}" ON storage.objects;\n${p}"${pn}"${o}`
      : `${p}"${pn}"${o}`;
  });
  s = s.replace(/(DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?)"([^"]+)"(\s+ON\s+storage\.objects)/gi, (m, p, n, o) =>
    n.startsWith(schema + ' ') ? m : `${p}"${schema} ${n}"${o}`);
  for (const [oldId, newId] of Object.entries(buckets)) s = s.split(`'${oldId}'`).join(`'${newId}'`);
  s = s.replace(/INSERT\s+INTO\s+storage\.buckets[^;]*;/gi, (m) => {
    if (/ON\s+CONFLICT/i.test(m)) return m;
    notes.warnings.push('storage.buckets insert without ON CONFLICT: added ON CONFLICT DO NOTHING');
    return m.replace(/;\s*$/, ' ON CONFLICT (id) DO NOTHING;');
  });
  if (/storage\.(?!objects|buckets|foldername|filename|extension)\w+/i.test(s))
    notes.warnings.push('references other storage.* objects (review)');

  // 8. ALTER PUBLICATION (top-level) -> tolerant DO block, qualified.
  s = s.replace(/^ALTER\s+PUBLICATION\s+(\w+)\s+ADD\s+TABLE\s+([^;]+);/gim, (m, pub, tbl) => {
    const t = tbl.trim();
    const q = t.includes('.') ? t : `${schema}.${t}`;
    return `DO $vwpub$ BEGIN ALTER PUBLICATION ${pub} ADD TABLE ${q}; EXCEPTION WHEN duplicate_object THEN NULL; END $vwpub$;`;
  });

  // 9. Explicit transaction control.
  s = s.replace(/^[ \t]*(BEGIN|COMMIT|START\s+TRANSACTION)\s*;[ \t]*$/gim, (m) => {
    notes.skipped.push(`transaction control: ${m.trim()}`);
    return `-- ${m.trim()} (stripped)`;
  });

  // 10. Risk scan.
  const risk = [
    [/\bCREATE\s+SCHEMA\b/i, 'CREATE SCHEMA'], [/\bALTER\s+SCHEMA\b/i, 'ALTER SCHEMA'],
    [/\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i, 'ROLE DDL'], [/\bALTER\s+DEFAULT\s+PRIVILEGES\b/i, 'ALTER DEFAULT PRIVILEGES'],
    [/\bALTER\s+(?:TABLE|FUNCTION|VIEW)\s+auth\./i, 'ALTER on auth.*'], [/\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+auth\./i, 'DML on auth.*'],
    [/\bALTER\s+SYSTEM\b|\bALTER\s+DATABASE\b/i, 'ALTER SYSTEM/DATABASE'], [/\bTO\s+postgres\b|\bOWNER\s+TO\b/i, 'OWNER/postgres grant'],
    [/\bDROP\s+SCHEMA\b/i, 'DROP SCHEMA'], [/\bON\s+(?:realtime|extensions|cron|vault|net)\./i, 'touches foreign schema'],
    [/\b(?:CREATE|ALTER|DROP)\s+POLICY\b[^;]*\bON\s+(?:auth|realtime)\./i, 'policy on foreign table'],
    [/\bcron\.(?!schedule|unschedule)\w+/i, 'other cron.* usage'],
  ];
  const lines = s.split('\n');
  for (const [re, label] of risk)
    for (let i = 0; i < lines.length; i++)
      if (re.test(lines[i])) notes.warnings.push(`${label}: line ${i + 1}: ${lines[i].trim().slice(0, 140)}`);
  for (let i = 0; i < lines.length; i++) {
    if (/\bauth\.(?!uid\(|role\(|jwt\(|users\b)\w+/i.test(lines[i]))
      notes.warnings.push(`auth.* reference: line ${i + 1}: ${lines[i].trim().slice(0, 140)}`);
    // ignore our own generated search_path and the PUBLIC pseudo-role (REVOKE ... FROM PUBLIC) - expected
    const l = lines[i].replace(new RegExp(`search_path = ${schema}, extensions`, 'g'), '').replace(/\b(?:FROM|TO)\s+PUBLIC\b/g, '');
    if (/\bpublic\b/i.test(l)) notes.leftoverPublic.push(`${fileLabel}:${i + 1}: ${lines[i].trim().slice(0, 160)}`);
  }
  return { sql: s, notes };
}

/** Split transformed SQL so every ALTER TYPE ... ADD VALUE statement runs alone (own call/transaction). */
export function splitChunks(sqlText) {
  const re = /^ALTER\s+TYPE\s+[^;]+?\s+ADD\s+VALUE\b[^;]*;/gim;
  const out = [];
  let last = 0, m;
  while ((m = re.exec(sqlText))) {
    if (m.index > last) out.push(sqlText.slice(last, m.index));
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < sqlText.length) out.push(sqlText.slice(last));
  return out.filter((c) => c.trim());
}
