-- 010_montaj_tables.sql
-- Katman 12: Montaj batch tablosu

-- ─── MONTAJ BATCHES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.montaj_batches (
    montaj_id       TEXT PRIMARY KEY,                            -- MON-XXXX format
    sku             TEXT NOT NULL,                                -- FK → products(sku)
    adet            INTEGER NOT NULL DEFAULT 1,
    durum           TEXT NOT NULL DEFAULT 'bekliyor',             -- bekliyor / montajda / tamamlandi
    current_step_no INTEGER DEFAULT 0,                           -- Hangi adimda (0=baslamadi)
    total_steps     INTEGER DEFAULT 0,                           -- Toplam adim sayisi
    operator_id     TEXT,
    operator_name   TEXT,
    email           TEXT,
    baslama_zamani  TIMESTAMPTZ,
    bitis_zamani    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_montaj_batches_durum ON public.montaj_batches (durum);
CREATE INDEX IF NOT EXISTS idx_montaj_batches_sku ON public.montaj_batches (sku);
CREATE INDEX IF NOT EXISTS idx_montaj_batches_created ON public.montaj_batches (created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.montaj_batches ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "montaj_batches_select"
    ON public.montaj_batches
    FOR SELECT
    TO authenticated
    USING (true);

-- Uretim erisimliler ekleyebilir
CREATE POLICY "montaj_batches_insert"
    ON public.montaj_batches
    FOR INSERT
    TO authenticated
    WITH CHECK (has_production_access());

-- Uretim erisimliler guncelleyebilir
CREATE POLICY "montaj_batches_update"
    ON public.montaj_batches
    FOR UPDATE
    TO authenticated
    USING (has_production_access());

-- Sadece admin silebilir
CREATE POLICY "montaj_batches_delete"
    ON public.montaj_batches
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ─── REALTIME ────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.montaj_batches;
