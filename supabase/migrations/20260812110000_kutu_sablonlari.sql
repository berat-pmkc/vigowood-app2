-- =============================================================
-- KUTU ŞABLONLARI
--
-- Amaç: kutu ölçüsünü (iç L/W/H) bir kez tanımlayıp ürün adıyla
-- kaydetmek, açık kutu çizimini o ölçüden üretmek ve kutu/koli
-- tüketimini aylık ölçebilmek.
--
-- Ölçü birimi MİLİMETRE — makine programı da mm kullanıyor
-- (570 x 310 x 50 gibi). cm'e çevirmek yuvarlama hatası doğururdu.
--
-- Hesaplanan levha ölçüsü (en/boy/alan) burada SAKLANIYOR, çünkü
-- formül ileride düzeltilirse eski şablonların hangi ölçüyle
-- üretildiği kaybolmasın. Ekran her zaman canlı hesabı gösterir;
-- kayıt anındaki değer arşiv niteliğinde.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.kutu_sablonlari (
  sablon_id     TEXT PRIMARY KEY,
  ad            TEXT NOT NULL,
  -- FEFCO standardı: 0201 (Amerikan kutu) veya 0401 (tek parça sarma)
  fefco_kodu    TEXT NOT NULL DEFAULT '0201' CHECK (fefco_kodu IN ('0201','0401')),

  -- İç ölçüler (mm)
  ic_uzunluk    NUMERIC(8,1) NOT NULL CHECK (ic_uzunluk  > 0),
  ic_genislik   NUMERIC(8,1) NOT NULL CHECK (ic_genislik > 0),
  ic_yukseklik  NUMERIC(8,1) NOT NULL CHECK (ic_yukseklik > 0),

  -- Hesaplanan levha ölçüsü (mm) ve alan (m²) — kayıt anındaki değer
  hesaplanan_en  NUMERIC(10,1),
  hesaplanan_boy NUMERIC(10,1),
  alan_m2        NUMERIC(10,4),

  -- Bağlantılar: hangi ambalaj parçası, hangi ürün için
  part_id       TEXT REFERENCES public.all_parts(part_id) ON DELETE SET NULL,
  sku           TEXT,
  oluk_tipi     TEXT,
  notlar        TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturan     TEXT REFERENCES public.users(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kutu_sablon_part ON public.kutu_sablonlari (part_id);
CREATE INDEX IF NOT EXISTS idx_kutu_sablon_sku  ON public.kutu_sablonlari (sku);
CREATE INDEX IF NOT EXISTS idx_kutu_sablon_aktif ON public.kutu_sablonlari (aktif, ad);

DROP TRIGGER IF EXISTS set_kutu_sablonlari_updated_at ON public.kutu_sablonlari;
CREATE TRIGGER set_kutu_sablonlari_updated_at
  BEFORE UPDATE ON public.kutu_sablonlari
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.kutu_sablonlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kutu sablon oku" ON public.kutu_sablonlari;
DROP POLICY IF EXISTS "kutu sablon yaz" ON public.kutu_sablonlari;
DROP POLICY IF EXISTS "kutu sablon sil" ON public.kutu_sablonlari;
CREATE POLICY "kutu sablon oku" ON public.kutu_sablonlari
  FOR SELECT TO authenticated USING (public.has_production_access());
CREATE POLICY "kutu sablon yaz" ON public.kutu_sablonlari
  FOR ALL TO authenticated USING (public.has_production_access())
  WITH CHECK (public.has_production_access());
CREATE POLICY "kutu sablon sil" ON public.kutu_sablonlari
  FOR DELETE TO authenticated USING (public.is_admin_or_engineer());

-- =============================================================
-- Aylık kutu/koli tüketimi
--
-- kutu_uretim seansları part bazında toplanır; şablonu olan parçalar
-- için levha alanı da çarpılarak m² tüketimi çıkar. Şablonu olmayan
-- parça alansız görünür (NULL), sıfır değil — "bilinmiyor" ile
-- "kullanılmadı" karışmasın.
-- =============================================================
CREATE OR REPLACE VIEW public.kutu_aylik_tuketim AS
SELECT date_trunc('month', u.tarih)::date AS ay,
       u.part_id,
       u.part_adi,
       s.sablon_id,
       s.ad          AS sablon_adi,
       s.fefco_kodu,
       sum(u.qty)    AS adet,
       CASE WHEN s.alan_m2 IS NOT NULL
            THEN round(sum(u.qty) * s.alan_m2, 2) END AS toplam_m2,
       count(*)      AS seans
FROM public.kutu_uretim u
LEFT JOIN LATERAL (
  SELECT k.* FROM public.kutu_sablonlari k
  WHERE k.part_id = u.part_id AND k.aktif
  ORDER BY k.updated_at DESC LIMIT 1
) s ON TRUE
WHERE u.durum = 'tamamlandi' AND u.tarih IS NOT NULL
GROUP BY 1, 2, 3, 4, 5, 6, s.alan_m2;

ALTER VIEW public.kutu_aylik_tuketim SET (security_invoker = true);
GRANT SELECT ON public.kutu_aylik_tuketim TO authenticated;
