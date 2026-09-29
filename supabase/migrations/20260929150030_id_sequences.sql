-- VigoWood Platform — Atomic sequential ID generation
-- Problem: application code generates TEXT primary keys (KES-0001, ASM-0002, ...) by
-- reading the current max id client-side and computing max+1 before insert. Two
-- near-simultaneous requests (double-click, fast resubmit) can read the same "last"
-- row and compute the same "next" id, causing "duplicate key value violates unique
-- constraint" errors on step_bom_pkey, cut_batches_pkey and others.
--
-- Fix: a single shared counter table + a SECURITY DEFINER function that atomically
-- reserves the next number for a given prefix via an UPDATE ... RETURNING, which
-- takes a row-level lock under Postgres MVCC — no explicit FOR UPDATE needed.
--
-- NOTE: this migration was applied directly to the production database on
-- 2026-09-29 (version 20260929150030) before this file was committed to the repo.
-- This file mirrors that already-applied change so `supabase migration list` /
-- `supabase db push` stay in sync and no one re-applies it by hand.

-- ============================================================
-- 1. Counter table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.id_sequences (
  prefix TEXT PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only public.next_id() (SECURITY DEFINER) touches this table. No direct client
-- access is needed or wanted, so RLS is enabled with no policies attached.
ALTER TABLE public.id_sequences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER id_sequences_updated_at
  BEFORE UPDATE ON public.id_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. Atomic next_id() function
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_id(p_prefix TEXT, p_width INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.id_sequences (prefix, last_value)
  VALUES (p_prefix, 0)
  ON CONFLICT (prefix) DO NOTHING;

  UPDATE public.id_sequences
  SET last_value = last_value + 1
  WHERE prefix = p_prefix
  RETURNING last_value INTO v_next;

  RETURN p_prefix || lpad(v_next::text, p_width, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_id(TEXT, INT) TO authenticated;

-- ============================================================
-- 3. Seed each known prefix's counter from current data, so numbering
--    continues where the old client-side logic left off.
-- ============================================================

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'KES-', COALESCE(MAX((regexp_match(cut_id, '^KES-(\d+)$'))[1]::bigint), 0)
FROM public.cut_batches
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'K-', COALESCE(MAX((regexp_match(cut_line_id, '^K-(\d+)$'))[1]::bigint), 0)
FROM public.cut_lines
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'YMS-', COALESCE(MAX((regexp_match(yms_id, '^YMS-(\d+)$'))[1]::bigint), 0)
FROM public.yari_mamul_stok
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'SM-', COALESCE(MAX((regexp_match(mov_id, '^SM-(\d+)$'))[1]::bigint), 0)
FROM public.stock_movements
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'ASM-', COALESCE(MAX((regexp_match(step_id, '^ASM-(\d+)$'))[1]::bigint), 0)
FROM public.assembly_steps
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'SBOM-', COALESCE(MAX((regexp_match(step_bom_id, '^SBOM-(\d+)$'))[1]::bigint), 0)
FROM public.step_bom
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'HP', COALESCE(MAX((regexp_match(part_id, '^HP(\d+)$'))[1]::bigint), 0)
FROM public.all_parts
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'MDF', COALESCE(MAX((regexp_match(part_id, '^MDF(\d+)$'))[1]::bigint), 0)
FROM public.all_parts
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'PL-', COALESCE(MAX((regexp_match(plakalar_id, '^PL-(\d+)$'))[1]::bigint), 0)
FROM public.plakalar
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'KRT-', COALESCE(MAX((regexp_match(plakalar_id, '^KRT-(\d+)$'))[1]::bigint), 0)
FROM public.plakalar
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'PPart', COALESCE(MAX((regexp_match(ppart_id, '^PPart(\d+)$'))[1]::bigint), 0)
FROM public.plaka_parts
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'VW', COALESCE(MAX((regexp_match(user_id, '^VW(\d+)$'))[1]::bigint), 0)
FROM public.users
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.id_sequences (prefix, last_value)
SELECT 'TRP-', COALESCE(MAX((regexp_match(kodu, '^TRP-(\d+)$'))[1]::bigint), 0)
FROM public.tr_pazarlama
ON CONFLICT (prefix) DO UPDATE SET last_value = GREATEST(public.id_sequences.last_value, EXCLUDED.last_value);
