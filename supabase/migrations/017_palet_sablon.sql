-- =============================================
-- 017: Sevkiyat Palet Şablonları
-- Ürün-ülke bazlı palet konfigürasyonları
-- =============================================

CREATE TABLE public.sevkiyat_palet_sablon (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  urun_adi TEXT,
  palet_boyut TEXT NOT NULL,
  palet_yukseklik DECIMAL NOT NULL,
  en DECIMAL NOT NULL,
  boy DECIMAL NOT NULL,
  yuk DECIMAL NOT NULL,
  koli_adedi INTEGER NOT NULL,
  palette_koli INTEGER NOT NULL,
  koli_agirlik DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, sku)
);

-- Indexes
CREATE INDEX idx_palet_sablon_country ON public.sevkiyat_palet_sablon(country_code);
CREATE INDEX idx_palet_sablon_sku ON public.sevkiyat_palet_sablon(sku);

-- Updated_at trigger
CREATE TRIGGER set_palet_sablon_updated_at
  BEFORE UPDATE ON public.sevkiyat_palet_sablon
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.sevkiyat_palet_sablon ENABLE ROW LEVEL SECURITY;

-- SELECT: tüm authenticated kullanıcılar
CREATE POLICY "authenticated_select_palet_sablon"
  ON public.sevkiyat_palet_sablon
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: admin veya mühendis
CREATE POLICY "admin_insert_palet_sablon"
  ON public.sevkiyat_palet_sablon
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_engineer());

CREATE POLICY "admin_update_palet_sablon"
  ON public.sevkiyat_palet_sablon
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_engineer())
  WITH CHECK (is_admin_or_engineer());

CREATE POLICY "admin_delete_palet_sablon"
  ON public.sevkiyat_palet_sablon
  FOR DELETE
  TO authenticated
  USING (is_admin_or_engineer());
