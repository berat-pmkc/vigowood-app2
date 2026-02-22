-- ============================================================
-- Migration 031: MDF Stok Yönetimi — all_parts'a mdf_tipi + mdf_renk
-- ============================================================
-- MDF hazır elemanları plaka tipi+renk ile eşleştirmek için.
-- Kesim tamamlandığında eşleşen MDF'in stoğu otomatik düşecek.

-- 1. all_parts'a mdf_tipi ve mdf_renk kolonları ekle
ALTER TABLE public.all_parts ADD COLUMN IF NOT EXISTS mdf_tipi TEXT DEFAULT NULL;
ALTER TABLE public.all_parts ADD COLUMN IF NOT EXISTS mdf_renk TEXT DEFAULT NULL;

-- 2. Unique partial index: bir tipi+renk kombinasyonu tek bir MDF parçaya eşlenebilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_mdf_tipi_renk
  ON public.all_parts(mdf_tipi, mdf_renk)
  WHERE mdf_tipi IS NOT NULL AND mdf_renk IS NOT NULL;

-- 3. RLS: Production rolleri hazir_eleman_akis'e INSERT yapabilsin (kesim MDF düşümü için)
CREATE POLICY "Production can insert hazir_eleman_akis"
  ON public.hazir_eleman_akis
  FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

-- 4. RLS: Production rolleri all_parts UPDATE yapabilsin (MDF stok düşümü için)
CREATE POLICY "Production can update all_parts"
  ON public.all_parts
  FOR UPDATE
  TO authenticated
  USING (has_production_access());
