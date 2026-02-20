-- ============================================================
-- Migration 014: Hazır Eleman + İade enhancements (Katman 17)
-- ============================================================

-- 1. hazir_eleman_akis: tedarikçi notu kolonu
ALTER TABLE public.hazir_eleman_akis
  ADD COLUMN IF NOT EXISTS not_text TEXT;

-- 2. iade_giris: iade nedeni, müşteri bilgisi, operatör kolonları
ALTER TABLE public.iade_giris
  ADD COLUMN IF NOT EXISTS iade_nedeni TEXT,
  ADD COLUMN IF NOT EXISTS musteri_bilgisi TEXT,
  ADD COLUMN IF NOT EXISTS operator TEXT;

-- 3. SECURITY DEFINER fonksiyon: Stok erişim rolleri
--    KRİTİK: inline subquery YAZMA, her zaman SECURITY DEFINER kullan
CREATE OR REPLACE FUNCTION public.has_stock_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü', 'Muhasebe')
  );
$$;

-- 4. RLS: hazir_eleman_akis — stok yöneticileri INSERT yapabilir
CREATE POLICY "Stock managers can insert hazir_eleman_akis"
  ON public.hazir_eleman_akis
  FOR INSERT
  TO authenticated
  WITH CHECK (has_stock_access());

-- 5. RLS: iade_giris — stok yöneticileri INSERT yapabilir
CREATE POLICY "Stock managers can insert iade_giris"
  ON public.iade_giris
  FOR INSERT
  TO authenticated
  WITH CHECK (has_stock_access());

-- 6. RLS: stock_movements — stok yöneticileri INSERT yapabilir (iade akışı)
CREATE POLICY "Stock managers can insert stock_movements"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (has_stock_access());

-- 7. RLS: all_parts — stok yöneticileri UPDATE yapabilir (stok güncelleme)
CREATE POLICY "Stock managers can update all_parts"
  ON public.all_parts
  FOR UPDATE
  TO authenticated
  USING (has_stock_access());

-- 8. RLS: products — stok yöneticileri UPDATE yapabilir (iade stok güncelleme)
CREATE POLICY "Stock managers can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (has_stock_access());
