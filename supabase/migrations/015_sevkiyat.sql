-- ============================================================
-- Migration 015: Sevkiyat modülü (Katman 18)
-- ============================================================

-- 1. SECURITY DEFINER fonksiyon: Sevkiyat erişim rolleri
--    KRİTİK: inline subquery YAZMA, her zaman SECURITY DEFINER kullan
CREATE OR REPLACE FUNCTION public.has_sevkiyat_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'Sevkiyat Sorumlusu', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü')
  );
$$;

-- 2. sevkiyat tablosu
CREATE TABLE IF NOT EXISTS public.sevkiyat (
  sevkiyat_id TEXT PRIMARY KEY,
  musteri TEXT NOT NULL,
  ulke TEXT,
  sevk_tarihi DATE,
  konteyner_no TEXT,
  konteyner_tipi TEXT,
  durum TEXT NOT NULL DEFAULT 'bekliyor',
  not_text TEXT,
  operator_id TEXT,
  operator_name TEXT,
  email TEXT,
  hazirlama_zamani TIMESTAMPTZ,
  gonderim_zamani TIMESTAMPTZ,
  teslim_zamani TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on durum for filtering
CREATE INDEX IF NOT EXISTS idx_sevkiyat_durum ON public.sevkiyat(durum);
CREATE INDEX IF NOT EXISTS idx_sevkiyat_created_at ON public.sevkiyat(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER set_sevkiyat_updated_at
  BEFORE UPDATE ON public.sevkiyat
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. sevkiyat_items tablosu
CREATE TABLE IF NOT EXISTS public.sevkiyat_items (
  item_id TEXT PRIMARY KEY,
  sevkiyat_id TEXT NOT NULL REFERENCES public.sevkiyat(sevkiyat_id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  urun_adi TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sevkiyat_items_sevkiyat_id ON public.sevkiyat_items(sevkiyat_id);

-- 4. RLS: sevkiyat
ALTER TABLE public.sevkiyat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sevkiyat"
  ON public.sevkiyat
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sevkiyat managers can insert sevkiyat"
  ON public.sevkiyat
  FOR INSERT
  TO authenticated
  WITH CHECK (has_sevkiyat_access());

CREATE POLICY "Sevkiyat managers can update sevkiyat"
  ON public.sevkiyat
  FOR UPDATE
  TO authenticated
  USING (has_sevkiyat_access());

CREATE POLICY "Admins can delete sevkiyat"
  ON public.sevkiyat
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- 5. RLS: sevkiyat_items
ALTER TABLE public.sevkiyat_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sevkiyat_items"
  ON public.sevkiyat_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sevkiyat managers can insert sevkiyat_items"
  ON public.sevkiyat_items
  FOR INSERT
  TO authenticated
  WITH CHECK (has_sevkiyat_access());

CREATE POLICY "Sevkiyat managers can update sevkiyat_items"
  ON public.sevkiyat_items
  FOR UPDATE
  TO authenticated
  USING (has_sevkiyat_access());

CREATE POLICY "Sevkiyat managers can delete sevkiyat_items"
  ON public.sevkiyat_items
  FOR DELETE
  TO authenticated
  USING (has_sevkiyat_access());

-- 6. Ek RLS: stock_movements INSERT + products UPDATE için sevkiyat erişimi
-- (Not: Bu policy'ler zaten varsa CREATE POLICY IF NOT EXISTS yok PostgreSQL'de,
--  bu yüzden DO block ile kontrol ediyoruz)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stock_movements'
    AND policyname = 'Sevkiyat managers can insert stock_movements'
  ) THEN
    CREATE POLICY "Sevkiyat managers can insert stock_movements"
      ON public.stock_movements
      FOR INSERT
      TO authenticated
      WITH CHECK (has_sevkiyat_access());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
    AND policyname = 'Sevkiyat managers can update products'
  ) THEN
    CREATE POLICY "Sevkiyat managers can update products"
      ON public.products
      FOR UPDATE
      TO authenticated
      USING (has_sevkiyat_access());
  END IF;
END $$;

-- 7. Realtime etkinleştirme
ALTER PUBLICATION supabase_realtime ADD TABLE public.sevkiyat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sevkiyat_items;
