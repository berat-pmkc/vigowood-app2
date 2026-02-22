-- ─── Montaj Sessions (Seans Bazlı Montaj) ───────────────────────────────────
-- Eski montaj_batches tablosu DB'de kalıyor ama UI'dan kaldırılıyor.
-- Yeni seans tablosu: bir operatör bir SKU+adım seçerek seans başlatır,
-- bitiş zamanı ve adet girilerek kapatılır, birim süre hesaplanır, BOM'a göre stok düşülür.

CREATE TABLE IF NOT EXISTS public.montaj_sessions (
  session_id       TEXT PRIMARY KEY,
  sku              TEXT NOT NULL,
  step_id          TEXT NOT NULL,
  step_name        TEXT,
  seq_no           INTEGER,
  is_final_step    BOOLEAN DEFAULT false,
  durum            TEXT NOT NULL DEFAULT 'montajda' CHECK (durum IN ('montajda', 'tamamlandi')),
  email            TEXT,
  operator_id      TEXT,
  operator_name    TEXT,
  start_time       TIMESTAMPTZ DEFAULT now(),
  end_time         TIMESTAMPTZ,
  qty              NUMERIC DEFAULT 0,
  worker_count     SMALLINT DEFAULT 1,
  workers          JSONB DEFAULT '[]'::jsonb,
  birim_montaj_dk  NUMERIC(10,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_durum ON public.montaj_sessions (durum);
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_sku ON public.montaj_sessions (sku);
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_step_id ON public.montaj_sessions (step_id);
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_created_at ON public.montaj_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_end_time ON public.montaj_sessions (end_time DESC);
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_final_done
  ON public.montaj_sessions (sku, qty)
  WHERE is_final_step = true AND durum = 'tamamlandi';

-- Trigger: updated_at
CREATE TRIGGER montaj_sessions_updated_at
  BEFORE UPDATE ON public.montaj_sessions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.montaj_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "montaj_sessions_select" ON public.montaj_sessions
  FOR SELECT USING (true);

CREATE POLICY "montaj_sessions_insert" ON public.montaj_sessions
  FOR INSERT WITH CHECK (has_production_access());

CREATE POLICY "montaj_sessions_update" ON public.montaj_sessions
  FOR UPDATE USING (has_production_access());

CREATE POLICY "montaj_sessions_delete" ON public.montaj_sessions
  FOR DELETE USING (is_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE montaj_sessions;
