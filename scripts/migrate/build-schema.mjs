#!/usr/bin/env node
// Build the VigoWood schema into the TARGET project from supabase/migrations + pending_migrations.
// Usage: node scripts/migrate/build-schema.mjs --schema vigowood_prova [--dry-run] [--start N] [--allow-existing]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, guardSchema, context, ensureOut, log, die, qi, ql } from './lib.mjs';
import { listMigrationFiles, transform, splitChunks, header, footer } from './transform.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const dry = !!args['dry-run'];
const start = parseInt(args.start ?? '0', 10);

const files = listMigrationFiles();
const outDir = ensureOut(schema);
if (!args.start)
  for (const f of fs.readdirSync(outDir)) if (/^\d{4}_.*\.sql$|^_setup\.sql$/.test(f)) fs.unlinkSync(path.join(outDir, f));

const setupSql = `
create schema if not exists ${qi(schema)};
create extension if not exists pg_trgm with schema extensions;
grant usage on schema ${qi(schema)} to anon, authenticated, service_role;
alter default privileges in schema ${qi(schema)} grant all on tables to anon, authenticated, service_role;
alter default privileges in schema ${qi(schema)} grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema ${qi(schema)} grant all on functions to anon, authenticated, service_role;
`.trim() + '\n';
fs.writeFileSync(path.join(outDir, '_setup.sql'), setupSql);

const plan = [];
const summary = { skipped: [], warnings: [], leftover: [] };
files.forEach((f, i) => {
  const raw = fs.readFileSync(f.full, 'utf8');
  const label = `${f.kind}/${f.name}`;
  const { sql, notes } = transform(raw, schema, label);
  const idx = String(i + 1).padStart(4, '0');
  const outName = `${idx}_${f.kind === 'pending' ? 'pending_' : ''}${f.name}`;
  fs.writeFileSync(path.join(outDir, outName), header(schema) + sql + footer);
  plan.push({ idx: i + 1, label, outName, sql });
  notes.skipped.forEach((x) => summary.skipped.push(`${label}: ${x}`));
  notes.warnings.forEach((x) => summary.warnings.push(`${label}: ${x}`));
  summary.leftover.push(...notes.leftoverPublic);
});

log(`Schema: ${schema}   files: ${files.length}   out: scripts/migrate/out/${schema}`);
log(`\n== Skipped / stripped statements (${summary.skipped.length}) ==`);
summary.skipped.forEach((x) => log('  ' + x));
log(`\n== Warnings for review (${summary.warnings.length}) ==`);
summary.warnings.forEach((x) => log('  ' + x));
log(`\n== Remaining "public" word occurrences after transform (${summary.leftover.length}) ==`);
summary.leftover.forEach((x) => log('  ' + x));
fs.writeFileSync(path.join(outDir, '_report.txt'),
  `SKIPPED\n${summary.skipped.join('\n')}\n\nWARNINGS\n${summary.warnings.join('\n')}\n\nLEFTOVER public\n${summary.leftover.join('\n')}\n`);

if (dry) { log('\n--dry-run: nothing executed (no network calls).'); process.exit(0); }

// ---- execute on TARGET ----
const ctx = context();
const existing = await ctx.tgt(
  `select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=${ql(schema)} and c.relkind in ('r','p','v','S')`,
  { readOnly: true });
if (existing[0].n > 0 && !args['allow-existing'] && !start)
  die(`Schema ${schema} already contains ${existing[0].n} relations on target. Run drop-schema.mjs first (or pass --allow-existing / --start N to resume).`);

if (!start) {
  log('\nSetup (schema, pg_trgm, grants)...');
  await ctx.tgt(setupSql, { label: '_setup.sql' });
}
let done = 0;
for (const p of plan) {
  if (p.idx < start) continue;
  const chunks = splitChunks(p.sql);
  let ci = 0;
  for (const c of chunks) {
    ci++;
    try {
      // Many migrations also seed data that references live rows missing from an empty schema; skip FK triggers.
      // The seeded rows are wiped by copy-data (truncate) anyway.
      const replica = 'set session_replication_role = replica;\n';
      await ctx.tgt(replica + header(schema) + c + footer, { label: p.label });
    } catch (e) {
      console.error(`\nFAILED at file #${p.idx}: ${p.label}${chunks.length > 1 ? ` (chunk ${ci}/${chunks.length})` : ''}`);
      console.error(`Transformed SQL: scripts/migrate/out/${schema}/${p.outName}`);
      console.error(String(e.message));
      console.error(`Applied OK so far: ${done} files. Fix, then resume with --start ${p.idx} (the failing chunk is rolled back as a unit).`);
      process.exit(1);
    }
  }
  done++;
  log(`  ok #${p.idx} ${p.label}`);
}
log(`\nAll ${done} migration files applied to ${schema}.`);
