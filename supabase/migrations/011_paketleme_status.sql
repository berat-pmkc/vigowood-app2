---------------------------------------------------
-- 011: Paketleme (PackEvents) Status & Operator Updates
-- Adds durum flow (bekliyor → paketlemede → tamamlandi)
-- Adds operator tracking fields
-- Fixes RLS to use SECURITY DEFINER functions
---------------------------------------------------

-- 1. Add new columns
ALTER TABLE public.pack_events
  ADD COLUMN IF NOT EXISTS durum TEXT NOT NULL DEFAULT 'bekliyor',
  ADD COLUMN IF NOT EXISTS operator_id TEXT,
  ADD COLUMN IF NOT EXISTS operator_name TEXT;

-- 2. Backfill existing records
-- Open → paketlemede (started but not finished — has start_time but no end_time)
-- Closed → tamamlandi
UPDATE public.pack_events SET durum = 'tamamlandi' WHERE status = 'Closed';
UPDATE public.pack_events SET durum = 'paketlemede' WHERE status = 'Open' AND start_time IS NOT NULL AND end_time IS NULL;
UPDATE public.pack_events SET durum = 'bekliyor' WHERE status = 'Open' AND start_time IS NULL;
-- Remaining Open with both start and end → tamamlandi
UPDATE public.pack_events SET durum = 'tamamlandi' WHERE status = 'Open' AND start_time IS NOT NULL AND end_time IS NOT NULL;

-- 3. Index on durum
CREATE INDEX IF NOT EXISTS idx_pack_events_durum ON public.pack_events(durum);

-- 4. Fix RLS policies — replace inline subqueries with SECURITY DEFINER functions
-- Drop old policies
DROP POLICY IF EXISTS "Yönetici can manage pack_events" ON public.pack_events;

-- Production users can INSERT and UPDATE
CREATE POLICY "Production can manage pack_events"
  ON public.pack_events FOR ALL TO authenticated
  USING (has_production_access())
  WITH CHECK (has_production_access());

-- Admin can DELETE
CREATE POLICY "Admin can delete pack_events"
  ON public.pack_events FOR DELETE TO authenticated
  USING (is_admin());

-- 5. Fix stock_movements RLS — also uses inline subquery
DROP POLICY IF EXISTS "Yönetici can manage stock_movements" ON public.stock_movements;

CREATE POLICY "Production can insert stock_movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (has_production_access());

CREATE POLICY "Admin can manage stock_movements"
  ON public.stock_movements FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 6. Enable realtime for pack_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.pack_events;
