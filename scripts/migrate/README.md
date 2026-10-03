# VigoWood -> schema migration scripts

Moves the VigoWood database (SOURCE `mdxaktebpuhlwacqcven`, schema `public`) into its own schema of the TARGET project
(`TARGET_PROJECT_REF`). Only ever creates/touches the schema you name (must start with `vigowood`); never modifies the
target's `public`/`numo` objects or existing auth users. Node 24, no dependencies, Supabase Management API only.

Config: `supabase/.env.migration.local` (git-ignored) with `TARGET_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` (target account),
`TARGET_SECRET_KEY`, `TARGET_PUBLISHABLE_KEY`, `SOURCE_ACCESS_TOKEN` (source account). Secrets are masked in logs.
Generated SQL goes to `scripts/migrate/out/<schema>/` (git-ignored).

Every destructive step needs `--yes` and refuses schema names not matching `^vigowood[a-z0-9_]*$`.

## (a) Rehearsal into `vigowood_prova`

```bash
S=vigowood_prova
node scripts/migrate/build-schema.mjs  --schema $S --dry-run     # inspect out/$S/*.sql and the report (no network)
node scripts/migrate/build-schema.mjs  --schema $S               # create schema + run all 135 migrations (stops on 1st error; resume with --start N)
node scripts/migrate/drop-excluded.mjs --schema $S --yes         # drop sales / marketplace / DIA tables (prints list first)
node scripts/migrate/compare-schema.mjs --schema $S              # read-only diff vs source (columns, functions, enums, indexes, policies, triggers)
node scripts/migrate/copy-data.mjs     --schema $S --yes         # truncate + copy + reset sequences + id_sequences + row-count verify
node scripts/migrate/auth-merge.mjs    --schema $S               # plan only (table of matched/create/skipped)
node scripts/migrate/auth-merge.mjs    --schema $S --yes         # link users.auth_id, create missing auth users, VW009 rename
node scripts/migrate/finalize.mjs      --schema $S --yes         # grants, realtime, cron, buckets, avatar URLs, PostgREST db_schema
```

Run `copy-data` (and `auth-merge`) again as often as needed during rehearsal: it truncates first, so it is repeatable.

## (b) Final cutover into `vigowood`

1. Freeze writes on the source app (maintenance mode) - copy reads with OFFSET paging and would otherwise miss/duplicate rows.
2. Run the same sequence with `S=vigowood` (`build-schema` -> `drop-excluded` -> `compare-schema` -> `copy-data` -> `auth-merge` -> `finalize`).
3. Check `copy-data` prints "All row counts match" and `compare-schema` is clean (except sales/marketplace-only functions/enums).
4. Point the app at the new project: Supabase client `db: { schema: 'vigowood' }`, target URL/keys, redeploy.
5. Storage objects (files in `task-attachments`, `user-avatars`) are NOT copied - copy them separately into buckets
   `vigowood-task-attachments` / `vigowood-user-avatars`. `finalize` already rewrites avatar URLs in the DB.

## Rollback

```bash
node scripts/migrate/auth-merge.mjs --schema $S --rollback --yes   # delete ONLY auth users created by auth-merge (out/auth-merge-report.$S.json)
node scripts/migrate/drop-schema.mjs --schema $S --yes             # drop schema cascade, its cron jobs, storage policies, PostgREST entry
```

Storage buckets are intentionally left (may contain files); delete in the dashboard if wanted.

## Notes / deviations

- Migration order: `NNN_*.sql` by number, then 14-digit timestamps, then `pending_migrations` numerically.
- Header per file is `set search_path = <schema>, extensions;` (`public` deliberately omitted so unqualified DROP/ALTER can
  never hit the other app's `public` objects); function `SET search_path` becomes `<schema>, extensions`.
- Bucket ids are `<schema>-task-attachments` / `<schema>-user-avatars` (= `vigowood-...` for the final schema, distinct for rehearsal).
  Storage policies on `storage.objects` are prefixed `<schema> `.
- The policy-rewrite migration (pending/003) is scoped to our schema only (original also scanned `public` and `storage`).
- Cron job: `<schema>-uretim-uyarilari`.
