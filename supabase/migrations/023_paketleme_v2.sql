-- 023_paketleme_v2.sql
-- Paketleme dashboard v2: worker tracking + birim süre analitik

-- Yeni kolonlar
ALTER TABLE pack_events
  ALTER COLUMN qty SET DEFAULT 0;

ALTER TABLE pack_events
  ADD COLUMN IF NOT EXISTS worker_count smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS birim_paketleme_dk numeric(10,2);

-- Mevcut veriler için worker_count dolduralım
UPDATE pack_events SET worker_count = 1 WHERE worker_count IS NULL;
