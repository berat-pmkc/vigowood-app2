-- 019: Sevkiyat v3 — Firma profilleri, maliyetler, döviz kurları, yeni kolonlar
-- Katman 18E: Kapsamlı revizyon

-- ─── 1A. sevkiyat_firmalar (Müşteri/Firma bilgileri) ────────────

CREATE TABLE IF NOT EXISTS public.sevkiyat_firmalar (
  id SERIAL PRIMARY KEY,
  firma_tipi TEXT NOT NULL, -- 'ihracatci' / 'alici' / 'banka' / 'imzalayan' / 'contact'
  country_code TEXT, -- NULL=global, 'DE'/'UK'/'USA'=ülkeye özel
  profil_adi TEXT NOT NULL,
  firma_adi TEXT,
  adres_satir1 TEXT,
  adres_satir2 TEXT,
  telefon TEXT,
  email TEXT,
  web TEXT,
  vergi_no TEXT,
  vat_no TEXT,
  banka_adi TEXT,
  sube_adi TEXT,
  swift_code TEXT,
  iban TEXT,
  para_birimi TEXT,
  sevk_yontemi TEXT,
  yetkili_adi TEXT,
  imza_yeri TEXT,
  aktif BOOLEAN DEFAULT true,
  varsayilan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_firmalar_updated_at
  BEFORE UPDATE ON public.sevkiyat_firmalar
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.sevkiyat_firmalar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firmalar_select" ON public.sevkiyat_firmalar
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "firmalar_admin_manage" ON public.sevkiyat_firmalar
  FOR ALL TO authenticated
  USING (is_admin_or_engineer())
  WITH CHECK (is_admin_or_engineer());

-- Seed: Mevcut config verilerini insert et
INSERT INTO public.sevkiyat_firmalar
  (firma_tipi, country_code, profil_adi, firma_adi, adres_satir1, adres_satir2, telefon, email, web, vergi_no, aktif, varsayilan)
VALUES
  ('ihracatci', NULL, 'HAS-MOB İhracatçı', 'HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'ÇATALPINAR MH. MERKEZ MÜCAVİR SK. NO:5 ÜNYE, ORDU', 'Vergi No: TR4580342463 / Unye', '+90 452 324 7878', 'info@hasmob.com.tr', 'hasmob.com.tr', 'TR4580342463', true, true);

INSERT INTO public.sevkiyat_firmalar
  (firma_tipi, country_code, profil_adi, firma_adi, vat_no, adres_satir1, aktif, varsayilan)
VALUES
  ('alici', 'DE', 'HAS-MOB Almanya', 'HAS-MOB ORMAN URUNLERI MOBILYA SANAYI VE TICARET LIMITED SIRKETI (Germany)', 'DE350448756', 'Catalpinar Mah. 5, 52300 Ordu', true, true),
  ('alici', 'UK', 'HAS-MOB İngiltere', 'HAS-MOB ORMAN URUNLERI MOBILYA SANAYI VE TICARET LIMITED SIRKETI', '0368836738', '346 WINSTON HOUSE 2-4 DOLLIS PARK LONDON', true, true),
  ('alici', 'USA', 'Hass Woodtech USA', 'Hass Woodtech LLC', '', '8 THE GREEN STREET STE:4000, DOVER, DE 19901 DE, USA', true, true);

INSERT INTO public.sevkiyat_firmalar
  (firma_tipi, country_code, profil_adi, firma_adi, banka_adi, sube_adi, swift_code, iban, para_birimi, aktif, varsayilan)
VALUES
  ('banka', 'DE', 'Vakıfbank EUR', 'HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI', 'VAKIFBANK', 'UNYE', 'TVBATR2AXXX', 'TR780001500158048020763636', 'EUR', true, true),
  ('banka', 'UK', 'Vakıfbank GBP', 'HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI', 'VAKIFBANK', 'UNYE', 'TVBATR2AXXX', 'TR950001500158048023394261', 'GBP', true, true),
  ('banka', 'USA', 'Halkbank USD', 'HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI', 'HALKBANK', 'UNYE', 'TVBATR2AXXX', 'TR180001500158048023593333', 'USD', true, true);

INSERT INTO public.sevkiyat_firmalar
  (firma_tipi, country_code, profil_adi, yetkili_adi, imza_yeri, firma_adi, aktif, varsayilan)
VALUES
  ('imzalayan', NULL, 'Hasan Çolakoğlu', 'HASAN ÇOLAKOĞLU', 'Ünye / Ordu', 'HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SAN.TİC.LTD.ŞTİ', true, true);

INSERT INTO public.sevkiyat_firmalar
  (firma_tipi, country_code, profil_adi, yetkili_adi, telefon, email, aktif, varsayilan)
VALUES
  ('contact', NULL, 'Sinan Çolakoğlu', 'Sinan Çolakoğlu', '+90 544 774 01 01', 'sinan@vigowood.com', true, true);

-- ─── 1B. ALTER sevkiyat tablosu ──────────────────────────────────

-- Araç tipi: konteyner/tir
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS arac_tipi TEXT DEFAULT 'konteyner';
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS tir_plaka TEXT;

-- İki tarih alanı
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS planlanan_sevk_tarihi DATE;
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS gerceklesen_sevk_tarihi DATE;

-- Mevcut sevk_tarihi verilerini planlanan'a taşı
UPDATE public.sevkiyat SET planlanan_sevk_tarihi = sevk_tarihi WHERE sevk_tarihi IS NOT NULL AND planlanan_sevk_tarihi IS NULL;

-- Firma referansları
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS ihracatci_firma_id INTEGER REFERENCES public.sevkiyat_firmalar(id);
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS alici_firma_id INTEGER REFERENCES public.sevkiyat_firmalar(id);
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS banka_firma_id INTEGER REFERENCES public.sevkiyat_firmalar(id);

-- ─── 1C. sevkiyat_maliyetler ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sevkiyat_maliyetler (
  id SERIAL PRIMARY KEY,
  sevkiyat_id TEXT NOT NULL REFERENCES public.sevkiyat(sevkiyat_id) ON DELETE CASCADE,
  navlun DECIMAL DEFAULT 0,
  navlun_currency TEXT DEFAULT 'USD',
  ic_nakliye DECIMAL DEFAULT 0,
  ic_nakliye_currency TEXT DEFAULT 'TRY',
  ara_depo DECIMAL DEFAULT 0,
  ara_depo_currency TEXT DEFAULT 'TRY',
  amazon_pickup DECIMAL DEFAULT 0,
  amazon_pickup_currency TEXT DEFAULT 'USD',
  ydg DECIMAL DEFAULT 0,
  ydg_currency TEXT DEFAULT 'USD',
  tr_gumruk DECIMAL DEFAULT 0,
  tr_gumruk_currency TEXT DEFAULT 'TRY',
  diger DECIMAL DEFAULT 0,
  diger_currency TEXT DEFAULT 'TRY',
  not_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sevkiyat_id)
);

CREATE TRIGGER set_maliyetler_updated_at
  BEFORE UPDATE ON public.sevkiyat_maliyetler
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.sevkiyat_maliyetler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maliyetler_select" ON public.sevkiyat_maliyetler
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "maliyetler_manage" ON public.sevkiyat_maliyetler
  FOR ALL TO authenticated
  USING (has_sevkiyat_access())
  WITH CHECK (has_sevkiyat_access());

-- ─── 1D. doviz_kurlari ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.doviz_kurlari (
  id SERIAL PRIMARY KEY,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  usd_try DECIMAL,
  eur_try DECIMAL,
  gbp_try DECIMAL,
  eur_usd DECIMAL,
  gbp_usd DECIMAL,
  gbp_eur DECIMAL,
  kaynak TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tarih)
);

ALTER TABLE public.doviz_kurlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kurlar_select" ON public.doviz_kurlari
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kurlar_admin_manage" ON public.doviz_kurlari
  FOR ALL TO authenticated
  USING (is_admin_or_engineer())
  WITH CHECK (is_admin_or_engineer());

-- ─── 1E. Palet şablon RLS genişletme ───────────────────────────

CREATE POLICY "sevkiyat_manage_palet_sablon" ON public.sevkiyat_palet_sablon
  FOR ALL TO authenticated
  USING (has_sevkiyat_access())
  WITH CHECK (has_sevkiyat_access());
