#!/usr/bin/env node
// Final wiring for the new schema on TARGET: grants, realtime, cron, storage buckets, avatar URLs, PostgREST exposure.
// Usage: node scripts/migrate/finalize.mjs --schema vigowood_prova [--yes]   (without --yes: read-only checks + plan)
import { parseArgs, guardSchema, context, log, warn, die, ql, qi, isExcluded, bucketIds, SOURCE_REF, SOURCE_SCHEMA, table } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const yes = !!args.yes;
const ctx = context();
const S = qi(schema);
const buckets = bucketIds(schema);

// ---- read-only checks ----
const tables = (await ctx.tgt(
  `select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname=${ql(schema)} and c.relkind in ('r','p') order by 1`, { readOnly: true }));
if (!tables.length) die(`Schema ${schema} has no tables on target.`);
const noRls = tables.filter((t) => !t.rls).map((t) => t.name);
if (noRls.length) warn(`tables WITHOUT row level security (will be reachable by anon/authenticated via grants!): ${noRls.join(', ')}`);
const views = await ctx.tgt(`select c.relname as name, coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker'),'off') as security_invoker
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=${ql(schema)} and c.relkind in ('v','m')`, { readOnly: true });
if (views.length) { log('Views (review RLS bypass; security_invoker=off bypasses RLS):'); log(table(views)); }

const pr = await ctx.tgtMgmt('GET', `/v1/projects/${ctx.targetRef}/postgrest`);
const curSchemas = String(pr.db_schema || '').split(',').map((x) => x.trim()).filter(Boolean);
log(`PostgREST db_schema BEFORE: ${curSchemas.join(',')}`);

const srcPub = (await ctx.src(`select tablename as t from pg_publication_tables where pubname='supabase_realtime' and schemaname=${ql(SOURCE_SCHEMA)}`)).map((r) => r.t);
const tgtPub = new Set((await ctx.tgt(`select tablename as t from pg_publication_tables where pubname='supabase_realtime' and schemaname=${ql(schema)}`, { readOnly: true })).map((r) => r.t));
const tableSet = new Set(tables.map((t) => t.name));
const rtAdd = srcPub.filter((t) => !isExcluded(t) && tableSet.has(t) && !tgtPub.has(t));
const fnExists = (await ctx.tgt(`select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=${ql(schema)} and p.proname='uretim_uyarilari_uret'`, { readOnly: true })).length > 0;
const jobName = `${schema}-uretim-uyarilari`;

log(`\nPlan:\n  1. grants on all tables/sequences/functions in ${schema} to anon, authenticated, service_role\n  2. realtime: add ${rtAdd.length} table(s): ${rtAdd.join(', ') || '-'}\n  3. cron job ${jobName} (*/15) ${fnExists ? '' : '[SKIPPED: function uretim_uyarilari_uret missing]'}\n  4. storage buckets: ${Object.values(buckets).join(', ')}\n  5. rewrite avatar/file URLs in text columns (old host -> new host, old bucket -> new bucket)\n  6. PostgREST db_schema: ${curSchemas.includes(schema) ? 'already contains ' + schema : 'append ' + schema}`);
if (!yes) die('Plan only. Re-run with --yes to apply.', 2);

// 1. grants
await ctx.tgt(`grant usage on schema ${S} to anon, authenticated, service_role;
grant all on all tables in schema ${S} to anon, authenticated, service_role;
grant all on all sequences in schema ${S} to anon, authenticated, service_role;
grant all on all functions in schema ${S} to anon, authenticated, service_role;`, { label: 'grants' });
log('1. grants done');

// 2. realtime
for (const t of rtAdd) {
  await ctx.tgt(`do $vwrt$ begin alter publication supabase_realtime add table ${S}.${qi(t)}; exception when duplicate_object then null; end $vwrt$;`, { label: `realtime ${t}` });
}
log(`2. realtime: ${rtAdd.length} table(s) added`);

// 3. cron
if (fnExists) {
  await ctx.tgt(`select cron.unschedule(jobname) from cron.job where jobname = ${ql(jobName)};
select cron.schedule(${ql(jobName)}, '*/15 * * * *', ${ql(`select ${schema}.uretim_uyarilari_uret();`)});`, { label: 'cron' });
  log(`3. cron ${jobName} scheduled`);
} else warn('3. cron skipped');

// 4. buckets
await ctx.tgt(`insert into storage.buckets (id, name, public) values (${ql(buckets['task-attachments'])}, ${ql(buckets['task-attachments'])}, false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values (${ql(buckets['user-avatars'])}, ${ql(buckets['user-avatars'])}, true) on conflict (id) do nothing;`, { label: 'buckets' });
log('4. buckets ensured (NOTE: files in the old buckets are NOT copied by these scripts)');

// 5. URL rewrite: users.avatar_url plus any text column named like url/path/link/avatar
const oldHost = `${SOURCE_REF}.supabase.co`, newHost = `${ctx.targetRef}.supabase.co`;
const cols = await ctx.tgt(
  `select c.table_name, c.column_name from information_schema.columns c
   join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
   where c.table_schema=${ql(schema)} and c.data_type in ('text','character varying')
     and (c.column_name ~* '(url|link|avatar)' or (c.table_name='users' and c.column_name='avatar_url'))`, { readOnly: true });
let rewritten = 0;
for (const c of cols) {
  const T = `${S}.${qi(c.table_name)}`, C = qi(c.column_name);
  let expr = `replace(${C}, ${ql(oldHost)}, ${ql(newHost)})`;
  for (const [o, n] of Object.entries(buckets)) expr = `replace(${expr}, ${ql('/' + o + '/')}, ${ql('/' + n + '/')})`;
  const r = await ctx.tgt(`set session_replication_role = replica;
with u as (update ${T} set ${C} = ${expr} where ${C} like ${ql('%' + oldHost + '%')} returning 1) select count(*)::int as n from u;`, { label: `urls ${c.table_name}.${c.column_name}` });
  const n = r?.[0]?.n ?? 0;
  if (n) { log(`   ${c.table_name}.${c.column_name}: ${n} row(s)`); rewritten += n; }
}
log(`5. URL rewrite: ${rewritten} value(s) across ${cols.length} candidate column(s)`);

// 6. PostgREST
if (!curSchemas.includes(schema)) {
  const next = [...curSchemas, schema].join(',');
  await ctx.tgtMgmt('PATCH', `/v1/projects/${ctx.targetRef}/postgrest`, { db_schema: next });
  const after = await ctx.tgtMgmt('GET', `/v1/projects/${ctx.targetRef}/postgrest`);
  log(`6. PostgREST db_schema AFTER: ${after.db_schema}`);
  for (const old of curSchemas) if (!String(after.db_schema).split(',').map((x) => x.trim()).includes(old)) warn(`existing schema "${old}" missing after PATCH!`);
} else log('6. PostgREST already exposes the schema');

// 7. PostgREST schema cache: new tables/views/functions are invisible to the API until reloaded.
await ctx.tgt(`notify pgrst, 'reload schema';`, { label: 'pgrst reload' });
log('7. PostgREST schema cache reloaded');

log('\nfinalize done. Frontend must use the schema: createClient(url, key, { db: { schema: "' + schema + '" } }).');
