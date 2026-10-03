#!/usr/bin/env node
// Read-only comparison of SOURCE public schema vs TARGET <schema>.
// Usage: node scripts/migrate/compare-schema.mjs --schema vigowood_prova
import { parseArgs, guardSchema, context, log, ql, isExcluded, SOURCE_SCHEMA } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();

const norm = (s) => String(s ?? '').split(`${schema}.`).join('').split('public.').join('');

const colsQ = (sch) => `
  select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable
  from information_schema.columns c
  where c.table_schema = ${ql(sch)}
  order by 1, c.ordinal_position`;
const funcQ = (sch) => `
  select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = ${ql(sch)}
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by 1, 2`;
const enumQ = (sch) => `
  select t.typname as typ, e.enumlabel as label
  from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = ${ql(sch)} order by 1, e.enumsortorder`;
const idxQ = (sch) => `select tablename as tbl, indexname as name from pg_indexes where schemaname = ${ql(sch)}`;
const polQ = (sch) => `select tablename as tbl, policyname as name from pg_policies where schemaname = ${ql(sch)}`;
const trgQ = (sch) => `
  select c.relname as tbl, t.tgname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${ql(sch)} and not t.tgisinternal`;

const [sc, tc, sf, tf, se, te, si, ti, sp, tp, st, tt] = await Promise.all([
  ctx.src(colsQ(SOURCE_SCHEMA)), ctx.tgt(colsQ(schema), { readOnly: true }),
  ctx.src(funcQ(SOURCE_SCHEMA)), ctx.tgt(funcQ(schema), { readOnly: true }),
  ctx.src(enumQ(SOURCE_SCHEMA)), ctx.tgt(enumQ(schema), { readOnly: true }),
  ctx.src(idxQ(SOURCE_SCHEMA)), ctx.tgt(idxQ(schema), { readOnly: true }),
  ctx.src(polQ(SOURCE_SCHEMA)), ctx.tgt(polQ(schema), { readOnly: true }),
  ctx.src(trgQ(SOURCE_SCHEMA)), ctx.tgt(trgQ(schema), { readOnly: true }),
]);

let problems = 0;
const out = (title, arr) => { if (arr.length) { problems += arr.length; log(`\n${title} (${arr.length})`); arr.forEach((x) => log('  ' + x)); } };

const group = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (isExcluded(r.table_name)) continue;
    if (!m.has(r.table_name)) m.set(r.table_name, new Map());
    m.get(r.table_name).set(r.column_name, `${r.data_type}/${r.udt_name}/${r.is_nullable}`);
  }
  return m;
};
const S = group(sc), T = group(tc);

out('Tables only in SOURCE (missing in target)', [...S.keys()].filter((t) => !T.has(t)));
out('Tables only in TARGET (not in source)', [...T.keys()].filter((t) => !S.has(t)));
const colMissing = [], colExtra = [], colDiff = [];
for (const [t, cols] of S) {
  if (!T.has(t)) continue;
  const tcols = T.get(t);
  for (const [c, ty] of cols) {
    if (!tcols.has(c)) colMissing.push(`${t}.${c} (${ty})`);
    else if (tcols.get(c) !== ty) colDiff.push(`${t}.${c}: source ${ty} vs target ${tcols.get(c)}`);
  }
  for (const c of tcols.keys()) if (!cols.has(c)) colExtra.push(`${t}.${c}`);
}
out('Columns in SOURCE missing in TARGET', colMissing);
out('Columns only in TARGET', colExtra);
out('Column type/nullability mismatches', colDiff);

const setDiff = (title, a, b, key) => {
  const A = new Set(a.map(key)), B = new Set(b.map(key));
  out(`${title}: only in SOURCE`, [...A].filter((x) => !B.has(x)).sort());
  out(`${title}: only in TARGET`, [...B].filter((x) => !A.has(x)).sort());
};
setDiff('Functions', sf, tf, (r) => `${r.name}(${norm(r.args)})`);
setDiff('Enum labels', se, te, (r) => `${r.typ}: ${r.label}`);
const notExcl = (r) => !isExcluded(r.tbl);
setDiff('Indexes', si.filter(notExcl), ti.filter(notExcl), (r) => `${r.tbl}.${r.name}`);
setDiff('Policies', sp.filter(notExcl), tp.filter(notExcl), (r) => `${r.tbl}.${r.name}`);
setDiff('Triggers', st.filter(notExcl), tt.filter(notExcl), (r) => `${r.tbl}.${r.name}`);

log(problems ? `\n${problems} difference(s) found.` : '\nNo differences found.');
log('Note: functions/enums of excluded (sales/marketplace) features may legitimately differ; review manually.');
