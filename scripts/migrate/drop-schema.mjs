#!/usr/bin/env node
// Rollback helper: drop schema CASCADE, its cron jobs, its storage policies and its PostgREST exposure on TARGET.
// Only schemas whose name starts with "vigowood" are accepted.
// Usage: node scripts/migrate/drop-schema.mjs --schema vigowood_prova --yes
import { parseArgs, guardSchema, context, log, warn, die, ql, qi, bucketIds } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();

const info = await ctx.tgt(
  `select (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=${ql(schema)} and c.relkind in ('r','p')) as tables,
          exists(select 1 from pg_namespace where nspname=${ql(schema)}) as present`, { readOnly: true });
const jobs = await ctx.tgt(`select jobname from cron.job where jobname like ${ql(schema + '-%')}`, { readOnly: true });
const pols = await ctx.tgt(`select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like ${ql(schema + ' %')}`, { readOnly: true });
log(`Schema ${schema}: present=${info[0].present}, tables=${info[0].tables}`);
log(`Cron jobs to unschedule: ${jobs.map((j) => j.jobname).join(', ') || '-'}`);
log(`Storage policies to drop: ${pols.map((p) => p.policyname).join(', ') || '-'}`);
if (!args.yes) die('Dry run. Re-run with --yes to DROP SCHEMA CASCADE (data in it is lost).', 2);

for (const j of jobs) await ctx.tgt(`select cron.unschedule(${ql(j.jobname)});`, { label: 'unschedule' });
for (const p of pols) await ctx.tgt(`drop policy if exists ${qi(p.policyname)} on storage.objects;`, { label: 'drop storage policy' });
// remove from realtime publication happens automatically on drop table
await ctx.tgt(`drop schema if exists ${qi(schema)} cascade;`, { label: 'drop schema' });
log('Schema dropped.');

const pr = await ctx.tgtMgmt('GET', `/v1/projects/${ctx.targetRef}/postgrest`);
const cur = String(pr.db_schema || '').split(',').map((x) => x.trim()).filter(Boolean);
if (cur.includes(schema)) {
  const next = cur.filter((x) => x !== schema);
  log(`PostgREST db_schema: ${cur.join(',')} -> ${next.join(',')}`);
  await ctx.tgtMgmt('PATCH', `/v1/projects/${ctx.targetRef}/postgrest`, { db_schema: next.join(',') });
} else log('PostgREST: schema was not exposed.');

const b = Object.values(bucketIds(schema));
warn(`Storage buckets were NOT deleted (may hold files): ${b.join(', ')}. Delete them from the dashboard if desired.`);
warn('Auth users created by auth-merge are NOT deleted: run auth-merge.mjs --rollback --yes BEFORE dropping if needed (it reads out/auth-merge-report.<schema>.json).');
