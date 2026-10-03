#!/usr/bin/env node
// Drop the tables we do NOT migrate (sales / marketplace / DIA) from the new schema on TARGET.
// Usage: node scripts/migrate/drop-excluded.mjs --schema vigowood_prova [--yes]
import { parseArgs, guardSchema, context, log, die, ql, qi, isExcluded } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();

const rows = await ctx.tgt(
  `select c.relname as name, c.relkind as kind from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname=${ql(schema)} and c.relkind in ('r','p') order by 1`, { readOnly: true });
const victims = rows.map((r) => r.name).filter(isExcluded);
log(`Tables in ${schema}: ${rows.length}; excluded (to drop): ${victims.length}`);
victims.forEach((t) => log('  - ' + t));
if (!victims.length) process.exit(0);

// Views that depend on them (CASCADE will drop these too).
const deps = await ctx.tgt(
  `select distinct v.relname as view_name, t.relname as depends_on
   from pg_depend d
   join pg_rewrite rw on rw.oid = d.objid
   join pg_class v on v.oid = rw.ev_class and v.relkind in ('v','m')
   join pg_class t on t.oid = d.refobjid
   join pg_namespace n on n.oid = v.relnamespace
   where n.nspname=${ql(schema)} and t.relname = any(${'array[' + victims.map(ql).join(',') + ']'}) and v.oid <> t.oid`, { readOnly: true });
if (deps.length) {
  log('\nViews/materialized views that will be dropped via CASCADE:');
  deps.forEach((d) => log(`  - ${d.view_name} (depends on ${d.depends_on})`));
}
if (!args.yes) die('Dry run only. Re-run with --yes to drop.', 2);

await ctx.tgt(`drop table ${victims.map((t) => `${qi(schema)}.${qi(t)}`).join(', ')} cascade;`, { label: 'drop-excluded' });
log(`\nDropped ${victims.length} tables from ${schema}.`);
