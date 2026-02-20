-- Migration 012: Kutu-Koli Üretim Tablosu
-- Katman 14: KUTU/KARTON parçaların üretim takibi

-- ─── TABLE ────────────────────────────────────────────────────────
CREATE TABLE public.kutu_uretim (
  session_id    TEXT PRIMARY KEY,              -- KUT-YYYYMMDD-HHMMSS
  email         TEXT,
  tarih         TIMESTAMPTZ,
  part_id       TEXT,                          -- FK → all_parts (KUTU/KARTON)
  part_adi      TEXT,                          -- Denormalize
  part_type     TEXT,                          -- 'KUTU' veya 'KARTON'
  qty           INTEGER NOT NULL DEFAULT 1,
  not_text      TEXT,
  durum         TEXT NOT NULL DEFAULT 'bekliyor',  -- bekliyor / uretimde / tamamlandi
  operator_id   TEXT,
  operator_name TEXT,
  start_time    TIMESTAMPTZ,
  bitis_zamani  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX idx_kutu_uretim_durum ON public.kutu_uretim(durum);
CREATE INDEX idx_kutu_uretim_part_id ON public.kutu_uretim(part_id);
CREATE INDEX idx_kutu_uretim_created ON public.kutu_uretim(created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────
-- KRİTİK: inline subquery YAZMA — SECURITY DEFINER fonksiyonlar kullan!
ALTER TABLE public.kutu_uretim ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Production can manage kutu_uretim"
  ON public.kutu_uretim
  FOR ALL TO authenticated
  USING (has_production_access())
  WITH CHECK (has_production_access());

CREATE POLICY "Admin full access kutu_uretim"
  ON public.kutu_uretim
  FOR ALL TO authenticated
  USING (is_admin());

-- ─── REALTIME ─────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.kutu_uretim;
