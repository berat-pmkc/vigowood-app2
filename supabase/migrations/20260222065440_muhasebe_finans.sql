-- ============================================================
-- muhasebe_finans.sql — Muhasebe ve Finans Tabloları
-- Alt Sistem A: Nakit Akış (dönemler, girişler, çıkışlar, ödemeler)
-- Alt Sistem B: Faaliyet Hesapları (satış, maliyet, kârlılık P&L)
-- ============================================================

-- ─── RLS Yardımcı Fonksiyon ────────────────────────────────────
-- Yönetici + Muhasebe + E-Ticaret Müdürü erişimi
CREATE OR REPLACE FUNCTION public.is_admin_or_finance()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'Muhasebe', 'E-Ticaret Müdürü')
      AND is_active = true
  );
$$;

-- ─── ENUM Tipleri ──────────────────────────────────────────────

-- Ödeme türü (13 tür)
DO $$ BEGIN
  CREATE TYPE public.odeme_turu AS ENUM (
    'PİYASA', 'KREDİ', 'KREDİ KARTI', 'MAAŞ', 'FAİZ',
    'SGK', 'VERGİ', 'HAMMADDE', 'PERSONEL', 'ELEKTRİK',
    'BANKA', 'GENEL', 'DİĞER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ödeme durumu
DO $$ BEGIN
  CREATE TYPE public.odeme_durumu AS ENUM ('TAMAMLANDI', 'BEKLİYOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Para birimi
DO $$ BEGIN
  CREATE TYPE public.para_birimi AS ENUM ('TL', 'USD', 'EUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Maliyet grubu
DO $$ BEGIN
  CREATE TYPE public.maliyet_grubu AS ENUM ('VIGO_WOOD', 'HAS_MOB', 'ORTAK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Faaliyet türü
DO $$ BEGIN
  CREATE TYPE public.faaliyet_turu AS ENUM ('FAALIYET', 'FAALIYET_DISI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Kârlılık kalem türü
DO $$ BEGIN
  CREATE TYPE public.kalem_turu AS ENUM (
    'GELIR', 'GIDER', 'TOPLAM', 'KAR', 'MARJ', 'FD_GELIR', 'FD_GIDER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- ALT SİSTEM A: NAKİT AKIŞ YÖNETİMİ
-- ═══════════════════════════════════════════════════════════════

-- ─── nakit_donemler ────────────────────────────────────────────
-- 15'er günlük dönem tanımları + KPI özet değerleri
CREATE TABLE IF NOT EXISTS public.nakit_donemler (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_kodu            TEXT UNIQUE NOT NULL,          -- 2026-1-D1, 2026-1-D2, 2026-2-D1
  baslangic_tarihi      DATE NOT NULL,
  bitis_tarihi          DATE NOT NULL,
  -- KPI özet değerleri
  varlik_acilis_tl      NUMERIC(14,2) DEFAULT 0,       -- Açılış varlık TL
  varlik_acilis_usd     NUMERIC(14,2) DEFAULT 0,       -- Açılış varlık USD
  nakit_giris_tl        NUMERIC(14,2) DEFAULT 0,       -- Toplam giriş TL
  nakit_giris_usd       NUMERIC(14,2) DEFAULT 0,       -- Toplam giriş USD
  nakit_cikis_tl        NUMERIC(14,2) DEFAULT 0,       -- Toplam çıkış TL
  nakit_cikis_usd       NUMERIC(14,2) DEFAULT 0,       -- Toplam çıkış USD
  varlik_tl             NUMERIC(14,2) DEFAULT 0,       -- Kapanış varlık TL
  varlik_usd            NUMERIC(14,2) DEFAULT 0,       -- Kapanış varlık USD
  yatirim_tl            NUMERIC(14,2) DEFAULT 0,       -- Yatırım TL
  toplam_varlik_tl      NUMERIC(14,2) DEFAULT 0,       -- Toplam varlık TL
  gayrinakit_islem      NUMERIC(14,2) DEFAULT 0,       -- Gayrinakit işlem
  toplam_piyasa_borcu   NUMERIC(14,2) DEFAULT 0,       -- Piyasa borcu
  toplam_kk_borc        NUMERIC(14,2) DEFAULT 0,       -- Kredi kartı borcu
  toplam_finansal_borc  NUMERIC(14,2) DEFAULT 0,       -- Finansal borç
  kur_bilgisi           NUMERIC(8,4) DEFAULT 0,        -- USD/TRY kur
  -- Meta
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nakit_donemler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nakit_donemler_select" ON public.nakit_donemler
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_donemler_insert" ON public.nakit_donemler
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "nakit_donemler_update" ON public.nakit_donemler
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_donemler_delete" ON public.nakit_donemler
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_nakit_donemler_kodu ON public.nakit_donemler(donem_kodu);

CREATE TRIGGER set_nakit_donemler_updated_at
  BEFORE UPDATE ON public.nakit_donemler
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── nakit_girisler ────────────────────────────────────────────
-- 1 satır/dönem — 12 kanal kolonu (flat yapı, Google Sheets ile 1:1)
CREATE TABLE IF NOT EXISTS public.nakit_girisler (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id          UUID NOT NULL REFERENCES public.nakit_donemler(id) ON DELETE CASCADE,
  -- TL kanallar
  vigowood_com      NUMERIC(14,2) DEFAULT 0,
  trendyol          NUMERIC(14,2) DEFAULT 0,
  hepsiburada       NUMERIC(14,2) DEFAULT 0,
  amazon            NUMERIC(14,2) DEFAULT 0,
  diger_pazaryeri   NUMERIC(14,2) DEFAULT 0,
  has_mob           NUMERIC(14,2) DEFAULT 0,
  doviz_satisi      NUMERIC(14,2) DEFAULT 0,
  nakit_kredi       NUMERIC(14,2) DEFAULT 0,
  toplam_tl         NUMERIC(14,2) DEFAULT 0,
  -- USD kanallar
  amazon_yurtdisi   NUMERIC(14,2) DEFAULT 0,
  diger_yurtdisi    NUMERIC(14,2) DEFAULT 0,
  toplam_yurtdisi   NUMERIC(14,2) DEFAULT 0,
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(donem_id)
);

ALTER TABLE public.nakit_girisler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nakit_girisler_select" ON public.nakit_girisler
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_girisler_insert" ON public.nakit_girisler
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "nakit_girisler_update" ON public.nakit_girisler
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_girisler_delete" ON public.nakit_girisler
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_nakit_girisler_donem ON public.nakit_girisler(donem_id);

CREATE TRIGGER set_nakit_girisler_updated_at
  BEFORE UPDATE ON public.nakit_girisler
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── nakit_cikislar ────────────────────────────────────────────
-- 1 satır/dönem — 22 TL + 5 USD kolon (flat yapı)
CREATE TABLE IF NOT EXISTS public.nakit_cikislar (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id                  UUID NOT NULL REFERENCES public.nakit_donemler(id) ON DELETE CASCADE,
  -- TL gider kategorileri (22)
  maas                      NUMERIC(14,2) DEFAULT 0,
  sgk                       NUMERIC(14,2) DEFAULT 0,
  hammadde                  NUMERIC(14,2) DEFAULT 0,
  akaryakit                 NUMERIC(14,2) DEFAULT 0,
  arac_bakim                NUMERIC(14,2) DEFAULT 0,
  demirbas                  NUMERIC(14,2) DEFAULT 0,
  elektrik                  NUMERIC(14,2) DEFAULT 0,
  su                        NUMERIC(14,2) DEFAULT 0,
  pazaryeri                 NUMERIC(14,2) DEFAULT 0,
  telekom                   NUMERIC(14,2) DEFAULT 0,
  makine_bakim              NUMERIC(14,2) DEFAULT 0,
  nakliye                   NUMERIC(14,2) DEFAULT 0,
  vergi                     NUMERIC(14,2) DEFAULT 0,
  mutfak                    NUMERIC(14,2) DEFAULT 0,
  hukuk                     NUMERIC(14,2) DEFAULT 0,
  muhasebe                  NUMERIC(14,2) DEFAULT 0,
  kredi_karti               NUMERIC(14,2) DEFAULT 0,
  kredi_odemesi             NUMERIC(14,2) DEFAULT 0,
  masraf_komisyon            NUMERIC(14,2) DEFAULT 0,
  diger_giderler            NUMERIC(14,2) DEFAULT 0,
  faaliyet_disi_harcamalar  NUMERIC(14,2) DEFAULT 0,
  toplam_tl                 NUMERIC(14,2) DEFAULT 0,
  -- USD gider kategorileri (5)
  gumruk_usd                NUMERIC(14,2) DEFAULT 0,
  navlun_usd                NUMERIC(14,2) DEFAULT 0,
  diger_usd                 NUMERIC(14,2) DEFAULT 0,
  doviz_bozdurma_usd        NUMERIC(14,2) DEFAULT 0,
  toplam_yurtdisi_usd       NUMERIC(14,2) DEFAULT 0,
  -- Meta
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE(donem_id)
);

ALTER TABLE public.nakit_cikislar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nakit_cikislar_select" ON public.nakit_cikislar
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_cikislar_insert" ON public.nakit_cikislar
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "nakit_cikislar_update" ON public.nakit_cikislar
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_cikislar_delete" ON public.nakit_cikislar
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_nakit_cikislar_donem ON public.nakit_cikislar(donem_id);

CREATE TRIGGER set_nakit_cikislar_updated_at
  BEFORE UPDATE ON public.nakit_cikislar
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── odemeler ──────────────────────────────────────────────────
-- Bireysel ödeme kayıtları (293+ satır)
CREATE TABLE IF NOT EXISTS public.odemeler (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanimi      TEXT NOT NULL,                            -- Ödeme tanımı
  tutar       NUMERIC(14,2) NOT NULL DEFAULT 0,        -- Tutar
  cinsi       public.para_birimi DEFAULT 'TL',         -- TL/USD/EUR
  tarih       DATE,                                     -- Ödeme tarihi
  turu        public.odeme_turu,                        -- 13 enum
  odeme_durum public.odeme_durumu DEFAULT 'BEKLİYOR',  -- TAMAMLANDI/BEKLİYOR
  -- Meta
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.odemeler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "odemeler_select" ON public.odemeler
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "odemeler_insert" ON public.odemeler
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "odemeler_update" ON public.odemeler
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "odemeler_delete" ON public.odemeler
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_odemeler_tarih ON public.odemeler(tarih);
CREATE INDEX IF NOT EXISTS idx_odemeler_turu ON public.odemeler(turu);
CREATE INDEX IF NOT EXISTS idx_odemeler_durum ON public.odemeler(odeme_durum);

CREATE TRIGGER set_odemeler_updated_at
  BEFORE UPDATE ON public.odemeler
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── nakit_giris_takip ─────────────────────────────────────────
-- Beklenen alacaklar
CREATE TABLE IF NOT EXISTS public.nakit_giris_takip (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanimi      TEXT NOT NULL,                            -- Tanım
  tutar       NUMERIC(14,2) NOT NULL DEFAULT 0,        -- Tutar
  cinsi       public.para_birimi DEFAULT 'TL',         -- TL/USD/EUR
  tarih       DATE,                                     -- Beklenen tarih
  turu        TEXT,                                      -- Kanal/tür (AMAZON, NAKİT, KART vb.)
  marka       TEXT,                                      -- VİGOWOOD, HASMOB
  odeme_durum public.odeme_durumu DEFAULT 'BEKLİYOR',  -- TAMAMLANDI/BEKLİYOR
  -- Meta
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nakit_giris_takip ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nakit_giris_takip_select" ON public.nakit_giris_takip
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_giris_takip_insert" ON public.nakit_giris_takip
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "nakit_giris_takip_update" ON public.nakit_giris_takip
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "nakit_giris_takip_delete" ON public.nakit_giris_takip
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_nakit_giris_takip_tarih ON public.nakit_giris_takip(tarih);
CREATE INDEX IF NOT EXISTS idx_nakit_giris_takip_durum ON public.nakit_giris_takip(odeme_durum);

CREATE TRIGGER set_nakit_giris_takip_updated_at
  BEFORE UPDATE ON public.nakit_giris_takip
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- ALT SİSTEM B: FAALİYET HESAPLARI (GELİR TABLOSU / P&L)
-- ═══════════════════════════════════════════════════════════════

-- ─── faaliyet_donemler ─────────────────────────────────────────
-- Aylık dönem tanımları
CREATE TABLE IF NOT EXISTS public.faaliyet_donemler (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_kodu      TEXT UNIQUE NOT NULL,                  -- 2026_01, 2026_02
  yil             INT NOT NULL,
  ay_no           INT NOT NULL CHECK (ay_no BETWEEN 1 AND 12),
  ceyrek          TEXT NOT NULL,                         -- Q1, Q2, Q3, Q4
  yari_yil        TEXT NOT NULL,                         -- H1, H2
  donem_label     TEXT,                                  -- Ocak 2026
  kur_tl_usd      NUMERIC(8,4) DEFAULT 0,              -- Ortalama kur
  -- Meta
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(yil, ay_no)
);

ALTER TABLE public.faaliyet_donemler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faaliyet_donemler_select" ON public.faaliyet_donemler
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "faaliyet_donemler_insert" ON public.faaliyet_donemler
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "faaliyet_donemler_update" ON public.faaliyet_donemler
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "faaliyet_donemler_delete" ON public.faaliyet_donemler
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_faaliyet_donemler_kodu ON public.faaliyet_donemler(donem_kodu);

CREATE TRIGGER set_faaliyet_donemler_updated_at
  BEFORE UPDATE ON public.faaliyet_donemler
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── satis_giris ───────────────────────────────────────────────
-- Aylık satış girişi (~20 satır/dönem)
CREATE TABLE IF NOT EXISTS public.satis_giris (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id        UUID NOT NULL REFERENCES public.faaliyet_donemler(id) ON DELETE CASCADE,
  marka           TEXT NOT NULL,                         -- VIGO WOOD, HAS-MOB
  kanal           TEXT NOT NULL,                         -- İHRACAT, YURTİÇİ
  tur             public.faaliyet_turu NOT NULL DEFAULT 'FAALIYET',
  pazaryeri       TEXT NOT NULL,                         -- AMAZON AMERİKA, TRENDYOL vb.
  ulke            TEXT,                                  -- AMERİKA, TÜRKİYE vb.
  tl_satislar     NUMERIC(14,2) DEFAULT 0,
  usd_satislar    NUMERIC(14,2) DEFAULT 0,
  -- Hesaplanan değerler (application-side)
  hesaplanan_tl   NUMERIC(14,2) DEFAULT 0,              -- TL + (USD × Kur)
  hesaplanan_usd  NUMERIC(14,2) DEFAULT 0,              -- USD + (TL / Kur)
  ortalama_kur    NUMERIC(8,4) DEFAULT 0,
  aktarim_tarihi  TIMESTAMPTZ DEFAULT now(),
  -- Meta
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.satis_giris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "satis_giris_select" ON public.satis_giris
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "satis_giris_insert" ON public.satis_giris
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "satis_giris_update" ON public.satis_giris
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "satis_giris_delete" ON public.satis_giris
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_satis_giris_donem ON public.satis_giris(donem_id);
CREATE INDEX IF NOT EXISTS idx_satis_giris_marka ON public.satis_giris(marka);

CREATE TRIGGER set_satis_giris_updated_at
  BEFORE UPDATE ON public.satis_giris
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── maliyet_giris ─────────────────────────────────────────────
-- Aylık maliyet girişi (~48 satır/dönem: 12 kategori × 3 grup + dağıtılmış)
CREATE TABLE IF NOT EXISTS public.maliyet_giris (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id        UUID NOT NULL REFERENCES public.faaliyet_donemler(id) ON DELETE CASCADE,
  tur             public.faaliyet_turu NOT NULL DEFAULT 'FAALIYET',
  kategori        TEXT NOT NULL,                         -- 12 maliyet kategorisi
  cari_adi        TEXT,                                  -- Hesap adı
  marka           TEXT NOT NULL,                         -- VIGO WOOD, HAS-MOB (dağıtım sonrası)
  maliyet_grubu   public.maliyet_grubu,                 -- Orijinal grup: VIGO_WOOD/HAS_MOB/ORTAK
  tl_maliyet      NUMERIC(14,2) DEFAULT 0,
  usd_maliyet     NUMERIC(14,2) DEFAULT 0,
  ortalama_kur    NUMERIC(8,4) DEFAULT 0,
  vigo_wood_orani NUMERIC(5,2),                          -- ORTAK dağıtım oranı (%)
  kaynak          TEXT,                                  -- Audit trail
  aktarim_tarihi  TIMESTAMPTZ DEFAULT now(),
  -- Meta
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.maliyet_giris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maliyet_giris_select" ON public.maliyet_giris
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "maliyet_giris_insert" ON public.maliyet_giris
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "maliyet_giris_update" ON public.maliyet_giris
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "maliyet_giris_delete" ON public.maliyet_giris
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_maliyet_giris_donem ON public.maliyet_giris(donem_id);
CREATE INDEX IF NOT EXISTS idx_maliyet_giris_marka ON public.maliyet_giris(marka);
CREATE INDEX IF NOT EXISTS idx_maliyet_giris_kategori ON public.maliyet_giris(kategori);

CREATE TRIGGER set_maliyet_giris_updated_at
  BEFORE UPDATE ON public.maliyet_giris
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── karlilik_data ─────────────────────────────────────────────
-- Hesaplanan P&L satırları (~80 satır/dönem)
CREATE TABLE IF NOT EXISTS public.karlilik_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id        UUID NOT NULL REFERENCES public.faaliyet_donemler(id) ON DELETE CASCADE,
  marka           TEXT NOT NULL,                         -- GENEL, VIGO WOOD, HAS-MOB
  sira            INT NOT NULL DEFAULT 0,                -- Sıralama
  kalem_turu      public.kalem_turu NOT NULL,             -- GELİR/GİDER/TOPLAM/KAR/MARJ/FD_GELİR/FD_GİDER
  kalem           TEXT NOT NULL,                         -- Satır adı
  aciklama        TEXT,                                  -- Not
  tl              NUMERIC(14,2) DEFAULT 0,
  usd             NUMERIC(14,2) DEFAULT 0,
  ortalama_kur    NUMERIC(8,4) DEFAULT 0,
  aktarim_tarihi  TIMESTAMPTZ DEFAULT now(),
  -- Meta
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.karlilik_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "karlilik_data_select" ON public.karlilik_data
  FOR SELECT TO authenticated USING (is_admin_or_finance());
CREATE POLICY "karlilik_data_insert" ON public.karlilik_data
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_finance());
CREATE POLICY "karlilik_data_update" ON public.karlilik_data
  FOR UPDATE TO authenticated USING (is_admin_or_finance());
CREATE POLICY "karlilik_data_delete" ON public.karlilik_data
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_karlilik_data_donem ON public.karlilik_data(donem_id);
CREATE INDEX IF NOT EXISTS idx_karlilik_data_marka ON public.karlilik_data(marka);
CREATE INDEX IF NOT EXISTS idx_karlilik_data_kalem_turu ON public.karlilik_data(kalem_turu);

CREATE TRIGGER set_karlilik_data_updated_at
  BEFORE UPDATE ON public.karlilik_data
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─── Realtime ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.odemeler;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nakit_donemler;
