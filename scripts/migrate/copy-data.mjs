#!/usr/bin/env node
// Copy data SOURCE public.* -> TARGET <schema>.*  (truncates the target tables first).
// Usage: node scripts/migrate/copy-data.mjs --schema vigowood_prova --yes [--tables a,b] [--no-truncate]
// Run during a write-freeze on the source: pages are read with OFFSET paging, so concurrent writes could skip/duplicate rows.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, guardSchema, context, log, warn, die, ql, qi, isExcluded, SOURCE_SCHEMA, table } from './lib.mjs';
import { listMigrationFiles, transform, header, footer } from './transform.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();
const onlyTables = args.tables ? String(args.tables).split(',').map((s) => s.trim()).filter(Boolean) : null;
const TARGET_BYTES = 4 * 1024 * 1024;
const REPL = 'set session_replication_role = replica;\n';

// ---- 1. table list on target ----
const tRows = await ctx.tgt(
  `select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname=${ql(schema)} and c.relkind in ('r','p') order by 1`, { readOnly: true });
let tables = tRows.map((r) => r.name).filter((t) => !isExcluded(t));
const sRows = await ctx.src(`select tablename as name from pg_tables where schemaname=${ql(SOURCE_SCHEMA)}`);
const srcSet = new Set(sRows.map((r) => r.name));
const missingInSrc = tables.filter((t) => !srcSet.has(t));
if (missingInSrc.length) warn(`tables absent in source (will be left empty): ${missingInSrc.join(', ')}`);
tables = tables.filter((t) => srcSet.has(t));
if (onlyTables) {
  const bad = onlyTables.filter((t) => !tables.includes(t));
  if (bad.length) die(`--tables contains unknown/excluded tables: ${bad.join(', ')}`);
  tables = tables.filter((t) => onlyTables.includes(t));
}

// ---- 2. topological order by FK ----
const fks = await ctx.tgt(
  `select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
   from pg_constraint c join pg_namespace n on n.oid=c.connamespace
   where c.contype='f' and n.nspname=${ql(schema)}`, { readOnly: true });
const clean = (s) => s.replace(/"/g, '').replace(new RegExp(`^${schema}\\.`), '');
const deps = new Map(tables.map((t) => [t, new Set()]));
for (const f of fks) {
  const c = clean(f.child), p = clean(f.parent);
  if (c !== p && deps.has(c) && deps.has(p)) deps.get(c).add(p);
}
const ordered = [];
const left = new Set(tables);
while (left.size) {
  const ready = [...left].filter((t) => [...deps.get(t)].every((d) => !left.has(d))).sort();
  if (!ready.length) { warn(`FK cycle among: ${[...left].join(', ')} (FKs are not enforced during copy)`); ordered.push(...[...left].sort()); break; }
  ready.forEach((t) => { ordered.push(t); left.delete(t); });
}
log(`Tables to copy (${ordered.length}): ${ordered.join(', ')}`);
if (!args.yes) die('Dry run only. This TRUNCATES the target tables listed above. Re-run with --yes.', 2);

// ---- 3. truncate ----
if (!args['no-truncate']) {
  log('\nTruncating target tables...');
  await ctx.tgt(REPL + `truncate table ${ordered.map((t) => `${qi(schema)}.${qi(t)}`).join(', ')} restart identity cascade;`, { label: 'truncate' });
}

// ---- 4. copy ----
const results = [];
for (const t of ordered) {
  const [tcols, scols, pk] = await Promise.all([
    ctx.tgt(`select a.attname as name from pg_attribute a where a.attrelid = ${ql(`${qi(schema)}.${qi(t)}`)}::regclass
             and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' order by a.attnum`, { readOnly: true }),
    ctx.src(`select column_name as name from information_schema.columns where table_schema=${ql(SOURCE_SCHEMA)} and table_name=${ql(t)}`),
    ctx.src(`select a.attname as name from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey)
             where i.indrelid = ${ql(`${qi(SOURCE_SCHEMA)}.${qi(t)}`)}::regclass and i.indisprimary order by array_position(i.indkey::int2[], a.attnum)`),
  ]);
  const sset = new Set(scols.map((r) => r.name)), tset = new Set(tcols.map((r) => r.name));
  const cols = tcols.map((r) => r.name).filter((c) => sset.has(c));
  const onlyT = [...tset].filter((c) => !sset.has(c)), onlyS = [...sset].filter((c) => !tset.has(c));
  if (onlyT.length) warn(`${t}: columns only in target (default/null used): ${onlyT.join(', ')}`);
  if (onlyS.length) warn(`${t}: columns only in source (dropped): ${onlyS.join(', ')}`);
  const colList = cols.map(qi).join(', ');
  const orderBy = pk.length ? pk.map((r) => qi(r.name)).join(', ') : 'ctid';

  let limit = 2000, offset = 0, rowsCopied = 0, page = 0;
  for (;;) {
    const r = await ctx.src(
      `select coalesce(json_agg(t), '[]'::json)::text as j, count(*)::int as n
       from (select ${colList} from ${qi(SOURCE_SCHEMA)}.${qi(t)} order by ${orderBy} limit ${limit} offset ${offset}) t`,
      { label: `read ${t}@${offset}` });
    const json = r[0].j, n = r[0].n, usedLimit = limit;
    if (n === 0) break;
    let tag;
    do { tag = '$vw' + crypto.randomBytes(6).toString('hex') + '$'; } while (json.includes(tag));
    await ctx.tgt(
      REPL + `insert into ${qi(schema)}.${qi(t)} (${colList}) overriding system value\n` +
      `select ${colList} from json_populate_recordset(null::${qi(schema)}.${qi(t)}, ${tag}${json}${tag}::json);`,
      { label: `insert ${t}@${offset}` });
    rowsCopied += n; offset += n; page++;
    const bytes = Buffer.byteLength(json);
    if (bytes > TARGET_BYTES * 1.25) limit = Math.max(50, Math.floor(limit / 2));
    else if (bytes < TARGET_BYTES / 4 && limit < 20000) limit = Math.min(20000, limit * 2);
    process.stdout.write(`\r  ${t}: ${rowsCopied} rows (page ${page}, ${(bytes / 1024).toFixed(0)} KB)      `);
    if (n < usedLimit) break; // short page = last page
  }
  process.stdout.write(`\r  ${t}: ${rowsCopied} rows copied                                   \n`);
  results.push({ table: t, copied: rowsCopied });
}

// ---- 5. sequences ----
log('\nResetting sequences...');
const seqs = await ctx.tgt(
  `select s.relname as seq, t.relname as tbl, a.attname as col
   from pg_class s join pg_namespace n on n.oid = s.relnamespace
   join pg_depend d on d.objid = s.oid and d.deptype in ('a','i') and d.classid = 'pg_class'::regclass
   join pg_class t on t.oid = d.refobjid
   join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
   where s.relkind = 'S' and n.nspname = ${ql(schema)}`, { readOnly: true });
if (seqs.length) {
  const stmts = seqs.map((q) => {
    const m = `(select max(${qi(q.col)}) from ${qi(schema)}.${qi(q.tbl)})`;
    return `select setval(${ql(`${qi(schema)}.${qi(q.seq)}`)}::regclass, coalesce(${m}, 1), ${m} is not null);`;
  });
  await ctx.tgt(stmts.join('\n'), { label: 'setval' });
}
log(`  ${seqs.length} owned sequence(s) reset.`);

// next_id() counters: re-run the INSERT ... ON CONFLICT seeding statements found in migrations (transformed for the schema).
const seedStmts = [];
for (const f of listMigrationFiles()) {
  const { sql } = transform(fs.readFileSync(f.full, 'utf8'), schema, f.name);
  const re = /INSERT\s+INTO\s+[\w".]*id_sequences\s*\([^)]*\)\s*SELECT[\s\S]*?;/gi;
  let m;
  while ((m = re.exec(sql))) {
    const from = m[0].match(/\bFROM\s+(?:[\w"]+\.)?"?(\w+)"?/i)?.[1];
    if (from && !ordered.includes(from)) { log(`  (skip seed from ${from}: not a migrated table)`); continue; }
    seedStmts.push(m[0]);
  }
}
if (seedStmts.length && ordered.includes('id_sequences')) {
  await ctx.tgt(header(schema) + REPL + seedStmts.join('\n') + footer, { label: 'id_sequences seed' });
  log(`  id_sequences re-seeded from data (${seedStmts.length} statements, GREATEST semantics).`);
}

// ---- 6. verify ----
log('\nVerifying row counts...');
const q = (sch, t) => `select ${ql(t)} as t, count(*)::bigint as n from ${qi(sch)}.${qi(t)}`;
const [sc, tc] = await Promise.all([
  ctx.src(ordered.map((t) => q(SOURCE_SCHEMA, t)).join('\nunion all\n')),
  ctx.tgt(ordered.map((t) => q(schema, t)).join('\nunion all\n'), { readOnly: true }),
]);
const sm = new Map(sc.map((r) => [r.t, Number(r.n)])), tm = new Map(tc.map((r) => [r.t, Number(r.n)]));
const rep = ordered.map((t) => ({ table: t, source: sm.get(t), target: tm.get(t), ok: sm.get(t) === tm.get(t) ? 'OK' : 'MISMATCH' }));
log(table(rep));
const bad = rep.filter((r) => r.ok !== 'OK');
log(bad.length ? `\n${bad.length} table(s) MISMATCH (source may have changed during copy; re-run for those with --tables).` : '\nAll row counts match.');
process.exit(bad.length ? 3 : 0);
