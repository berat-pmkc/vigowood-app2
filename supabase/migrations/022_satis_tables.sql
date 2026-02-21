-- ============================================================
-- 022_satis_tables.sql — Satış, TR Pazarlama, Kampanyalar
-- ============================================================

-- RLS yardımcı fonksiyon: Satış erişimi
CREATE OR REPLACE FUNCTION public.has_sales_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN (
        'Yönetici','Endüstri Mühendisi','E-Ticaret Müdürü',
        'Dış Ticaret Müdürü','Muhasebe','Pazaryeri Sorumlusu',
        'Mimar','Sevkiyat Sorumlusu'
      )
  );
$$;

-- ─── satis_raporlari ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.satis_raporlari (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rapor_id    TEXT UNIQUE NOT NULL,
  rapor_tarihi DATE NOT NULL,
  yukleme_tarihi TIMESTAMPTZ DEFAULT now(),
  yukleyen_id UUID REFERENCES auth.users(id),
  yukleyen_adi TEXT,
  dosya_adi   TEXT,
  toplam_satir INT DEFAULT 0,
  toplam_adet  INT DEFAULT 0,
  toplam_tutar DECIMAL(12,2) DEFAULT 0,
  tr_tutar     DECIMAL(12,2) DEFAULT 0,
  ihracat_tutar DECIMAL(12,2) DEFAULT 0,
  durum        TEXT DEFAULT 'aktif',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.satis_raporlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "satis_raporlari_select" ON public.satis_raporlari
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "satis_raporlari_insert" ON public.satis_raporlari
  FOR INSERT TO authenticated WITH CHECK (has_sales_access());
CREATE POLICY "satis_raporlari_update" ON public.satis_raporlari
  FOR UPDATE TO authenticated USING (has_sales_access());
CREATE POLICY "satis_raporlari_delete" ON public.satis_raporlari
  FOR DELETE TO authenticated USING (has_sales_access());

CREATE INDEX IF NOT EXISTS idx_satis_raporlari_tarihi ON public.satis_raporlari(rapor_tarihi);

CREATE TRIGGER set_satis_raporlari_updated_at
  BEFORE UPDATE ON public.satis_raporlari
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── satis_satirlari ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.satis_satirlari (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rapor_id     TEXT NOT NULL REFERENCES public.satis_raporlari(rapor_id) ON DELETE CASCADE,
  tarih        DATE,
  satis_kanali TEXT,
  fatura_no    TEXT,
  musteri_adi  TEXT,
  sku          TEXT,
  miktar       INT DEFAULT 0,
  birim_fiyat  DECIMAL(10,2) DEFAULT 0,
  toplam_tutar DECIMAL(12,2) DEFAULT 0,
  kdv_orani    DECIMAL(4,1),
  doviz        TEXT DEFAULT 'TL',
  is_hizmet    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.satis_satirlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "satis_satirlari_select" ON public.satis_satirlari
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "satis_satirlari_insert" ON public.satis_satirlari
  FOR INSERT TO authenticated WITH CHECK (has_sales_access());
CREATE POLICY "satis_satirlari_update" ON public.satis_satirlari
  FOR UPDATE TO authenticated USING (has_sales_access());
CREATE POLICY "satis_satirlari_delete" ON public.satis_satirlari
  FOR DELETE TO authenticated USING (has_sales_access());

CREATE INDEX IF NOT EXISTS idx_satis_satirlari_rapor ON public.satis_satirlari(rapor_id);
CREATE INDEX IF NOT EXISTS idx_satis_satirlari_fatura ON public.satis_satirlari(fatura_no);
CREATE INDEX IF NOT EXISTS idx_satis_satirlari_sku ON public.satis_satirlari(sku);
CREATE INDEX IF NOT EXISTS idx_satis_satirlari_tarih ON public.satis_satirlari(tarih);

-- ─── tr_pazarlama ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tr_pazarlama (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kodu              TEXT UNIQUE NOT NULL,
  yil               INT NOT NULL,
  ay                INT NOT NULL CHECK (ay BETWEEN 1 AND 12),
  pazaryeri         TEXT NOT NULL,
  hedef_ciro        DECIMAL(12,2) DEFAULT 0,
  gercek_ciro       DECIMAL(12,2) DEFAULT 0,
  siparis_sayisi    INT DEFAULT 0,
  ziyaretci         INT DEFAULT 0,
  donusum_orani     DECIMAL(5,2) DEFAULT 0,
  iadeler           INT DEFAULT 0,
  ortalama_sepet    DECIMAL(10,2),
  reklam_harcamasi  DECIMAL(10,2),
  not_text          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tr_pazarlama ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tr_pazarlama_select" ON public.tr_pazarlama
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tr_pazarlama_insert" ON public.tr_pazarlama
  FOR INSERT TO authenticated WITH CHECK (has_sales_access());
CREATE POLICY "tr_pazarlama_update" ON public.tr_pazarlama
  FOR UPDATE TO authenticated USING (has_sales_access());
CREATE POLICY "tr_pazarlama_delete" ON public.tr_pazarlama
  FOR DELETE TO authenticated USING (has_sales_access());

CREATE TRIGGER set_tr_pazarlama_updated_at
  BEFORE UPDATE ON public.tr_pazarlama
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── kampanyalar ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kampanyalar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kodu              TEXT UNIQUE NOT NULL,
  kampanya_adi      TEXT NOT NULL,
  baslangic_tarihi  DATE NOT NULL,
  bitis_tarihi      DATE NOT NULL,
  ana_hedef         TEXT,
  ziyaretci         INT,
  siparis_sayisi    INT,
  ciro              DECIMAL(12,2),
  donusum_orani     DECIMAL(5,2),
  ortalama_sepet    DECIMAL(10,2),
  notlar            TEXT,
  aktif_mi          BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kampanyalar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kampanyalar_select" ON public.kampanyalar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kampanyalar_insert" ON public.kampanyalar
  FOR INSERT TO authenticated WITH CHECK (has_sales_access());
CREATE POLICY "kampanyalar_update" ON public.kampanyalar
  FOR UPDATE TO authenticated USING (has_sales_access());
CREATE POLICY "kampanyalar_delete" ON public.kampanyalar
  FOR DELETE TO authenticated USING (has_sales_access());

CREATE TRIGGER set_kampanyalar_updated_at
  BEFORE UPDATE ON public.kampanyalar
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
