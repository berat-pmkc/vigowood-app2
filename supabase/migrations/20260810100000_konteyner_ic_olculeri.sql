-- Konteyner iç ölçüleri ve azami yük.
--
-- Yükleme planlaması için konteynerin iç hacmi gerekiyor; ayarlarda
-- yalnızca tip ve etiket vardı. Ölçüler iç net ölçülerdir (kapı açıklığı
-- değil), azami yük ise konteynerin taşıyabileceği net yük.
--
-- 40'HC iç: 1200 x 235 x 269 cm — HC40 optimizasyon çalışmasında kullanılan
-- değerlerle aynı, planlar arasında tutarlılık için.

UPDATE public.app_settings
SET value = '[
  {"type":"20ft",   "label":"20'' Konteyner",    "ic_uzunluk":590,  "ic_genislik":235, "ic_yukseklik":239, "max_yuk_kg":28000},
  {"type":"40ft",   "label":"40'' Konteyner",    "ic_uzunluk":1200, "ic_genislik":235, "ic_yukseklik":239, "max_yuk_kg":26500},
  {"type":"40ft HC","label":"40'' HC Konteyner", "ic_uzunluk":1200, "ic_genislik":235, "ic_yukseklik":269, "max_yuk_kg":26500}
]'::jsonb,
    updated_at = now()
WHERE key = 'sevkiyat_konteyner_tipleri';

INSERT INTO public.app_settings (key, value)
SELECT 'sevkiyat_konteyner_tipleri', '[
  {"type":"20ft",   "label":"20'' Konteyner",    "ic_uzunluk":590,  "ic_genislik":235, "ic_yukseklik":239, "max_yuk_kg":28000},
  {"type":"40ft",   "label":"40'' Konteyner",    "ic_uzunluk":1200, "ic_genislik":235, "ic_yukseklik":239, "max_yuk_kg":26500},
  {"type":"40ft HC","label":"40'' HC Konteyner", "ic_uzunluk":1200, "ic_genislik":235, "ic_yukseklik":269, "max_yuk_kg":26500}
]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'sevkiyat_konteyner_tipleri');

-- ─── Yükleme planları ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.yukleme_planlari (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad            TEXT NOT NULL,
  konteyner_tipi TEXT NOT NULL,
  -- Planın üretildiği konteyner ölçüsü; ayar sonradan değişse bile plan
  -- kendi ölçüleriyle yorumlanabilsin
  ic_uzunluk    NUMERIC(8,1) NOT NULL,
  ic_genislik   NUMERIC(8,1) NOT NULL,
  ic_yukseklik  NUMERIC(8,1) NOT NULL,
  -- Girdi: seçilen ürünler, kilit durumları, üst sınırlar
  girdi         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Çıktı: bloklar, dizilim tablosu, özet
  sonuc         JSONB NOT NULL DEFAULT '{}'::jsonb,
  doluluk_yuzde NUMERIC(5,2),
  toplam_koli   INTEGER,
  toplam_hacim  NUMERIC(10,3),
  toplam_agirlik NUMERIC(10,2),
  kullanilan_boy NUMERIC(8,1),
  durum         TEXT NOT NULL DEFAULT 'taslak' CHECK (durum IN ('taslak','onaylandi','sevkiyata_donustu')),
  sevkiyat_id   TEXT REFERENCES public.sevkiyat(sevkiyat_id) ON DELETE SET NULL,
  olusturan     TEXT REFERENCES public.users(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yukleme_planlari_durum
  ON public.yukleme_planlari (durum, created_at DESC);

DROP TRIGGER IF EXISTS set_yukleme_planlari_updated_at ON public.yukleme_planlari;
CREATE TRIGGER set_yukleme_planlari_updated_at
  BEFORE UPDATE ON public.yukleme_planlari
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.yukleme_planlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read yukleme_planlari" ON public.yukleme_planlari;
CREATE POLICY "Authenticated read yukleme_planlari"
  ON public.yukleme_planlari FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Sevkiyat manage yukleme_planlari" ON public.yukleme_planlari;
CREATE POLICY "Sevkiyat manage yukleme_planlari"
  ON public.yukleme_planlari FOR ALL TO authenticated
  USING (public.has_sevkiyat_access())
  WITH CHECK (public.has_sevkiyat_access());

COMMENT ON TABLE public.yukleme_planlari IS
  'Konteyner yükleme planları — planlama ekranında üretilir, onaylanınca sevkiyata dönüşür';
