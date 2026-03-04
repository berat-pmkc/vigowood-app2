-- =============================================
-- Shipping Snapshots — Kargo desi fiyat geçmişi
-- =============================================

CREATE TABLE public.shipping_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donem_kodu TEXT NOT NULL,
  shipping_provider_id UUID NOT NULL REFERENCES public.shipping_providers(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_code TEXT NOT NULL,
  desi_fiyatlari JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX idx_ss_donem ON public.shipping_snapshots(donem_kodu);
CREATE INDEX idx_ss_provider ON public.shipping_snapshots(shipping_provider_id);

-- RLS
ALTER TABLE public.shipping_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read shipping_snapshots"
  ON public.shipping_snapshots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manage shipping_snapshots"
  ON public.shipping_snapshots FOR ALL TO authenticated
  USING (public.is_admin());
