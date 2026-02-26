-- Trendyol Other Financials tablosu (Ödemeler, Komisyon Faturası, Platform Bedeli vb.)
CREATE TABLE IF NOT EXISTS public.trendyol_other_financials (
  id TEXT PRIMARY KEY,
  transaction_date TEXT,
  transaction_type TEXT NOT NULL,
  debt NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trendyol_other_fin_type ON public.trendyol_other_financials (transaction_type);
CREATE INDEX IF NOT EXISTS idx_trendyol_other_fin_date ON public.trendyol_other_financials (transaction_date DESC);

-- RLS
ALTER TABLE public.trendyol_other_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_other_fin" ON public.trendyol_other_financials
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "service_insert_other_fin" ON public.trendyol_other_financials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_update_other_fin" ON public.trendyol_other_financials
  FOR UPDATE USING (true);

CREATE POLICY "admin_delete_other_fin" ON public.trendyol_other_financials
  FOR DELETE USING (is_admin());
