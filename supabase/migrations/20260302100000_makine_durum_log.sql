-- Makine durum log tablosu (aktif/bakim toggle takibi)
CREATE TABLE public.makine_durum_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  makine_id   TEXT NOT NULL,
  durum       TEXT NOT NULL CHECK (durum IN ('aktif', 'bakim')),
  neden       TEXT,
  degistiren  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index: her makinenin son durumunu hızlı getirmek için
CREATE INDEX idx_makine_durum_log_makine_created
  ON public.makine_durum_log (makine_id, created_at DESC);

-- RLS
ALTER TABLE public.makine_durum_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_select_makine_durum_log"
  ON public.makine_durum_log FOR SELECT
  TO authenticated
  USING (has_production_access());

CREATE POLICY "production_insert_makine_durum_log"
  ON public.makine_durum_log FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

-- Seed: 3 kesim makinesi başlangıç durumu 'aktif'
INSERT INTO public.makine_durum_log (makine_id, durum, degistiren) VALUES
  ('MAK-1', 'aktif', 'SYSTEM'),
  ('MAK-2', 'aktif', 'SYSTEM'),
  ('MAK-3', 'aktif', 'SYSTEM');
