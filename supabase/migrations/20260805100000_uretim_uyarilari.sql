-- Üretim uyarı sistemi + mola planları
--
-- İki sorun izleniyor:
--   1. Sabah üretim seansı açmamış personel
--   2. Kapatılmamış (açık kalmış) montaj seansları
--
-- Açık seanslara DOKUNULMUYOR — seansı kapatmak "kaç adet yaptım" bilgisini
-- girmek demek. Otomatik kapatmak adet alanı boş kayıt üretirdi.

-- ─── 1. Mola planları ───────────────────────────────────────
-- Mola saatleri gruplara göre değişiyor. Cinsiyet alanı tutmak yerine
-- plan tanımlayıp kişileri plana bağlıyoruz — ileride vardiya değişirse
-- veya üçüncü bir plan gerekirse şema değişmiyor.

CREATE TABLE IF NOT EXISTS public.mola_planlari (
  id          SERIAL PRIMARY KEY,
  ad          TEXT NOT NULL UNIQUE,
  aciklama    TEXT,
  -- [{"ad":"Öğle","bas":"12:15","bit":"13:00"}, ...]
  araliklar   JSONB NOT NULL DEFAULT '[]'::jsonb,
  aktif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.mola_planlari (ad, aciklama, araliklar) VALUES
  ('Plan A', 'Öğle 12:15-13:00 · Çay 10:00-10:10 ve 15:00-15:20',
   '[{"ad":"Çay","bas":"10:00","bit":"10:10"},
     {"ad":"Öğle","bas":"12:15","bit":"13:00"},
     {"ad":"Çay","bas":"15:00","bit":"15:20"}]'::jsonb),
  ('Plan B', 'Öğle 12:45-13:30 · Çay 10:00-10:10 ve 15:40-16:00',
   '[{"ad":"Çay","bas":"10:00","bit":"10:10"},
     {"ad":"Öğle","bas":"12:45","bit":"13:30"},
     {"ad":"Çay","bas":"15:40","bit":"16:00"}]'::jsonb)
ON CONFLICT (ad) DO NOTHING;

-- ─── 2. Kullanıcı alanları ──────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mola_plani_id INTEGER REFERENCES public.mola_planlari(id),
  ADD COLUMN IF NOT EXISTS uretim_seansi_beklenir BOOLEAN NOT NULL DEFAULT true;

-- Varsayılan plan: herkes Plan A. Paketleme ve Temizlik ekibi için
-- Plan B'ye geçiş kullanıcı yönetimi ekranından yapılır.
UPDATE public.users SET mola_plani_id = (SELECT id FROM public.mola_planlari WHERE ad='Plan A')
WHERE mola_plani_id IS NULL;

-- Seans açması beklenmeyenler:
--   Hat rolü      → tabletlerdeki ortak giriş hesapları, gerçek kişi değil
--   Temizlik      → seans akışı dışında çalışıyor
--   Bekçi         → üretim yapmıyor
--   Üretim dışı roller (yönetim, ofis)
UPDATE public.users SET uretim_seansi_beklenir = false
WHERE role::text <> 'Üretim'
   OR station::text = 'Temizlik'
   OR full_name = 'Bekçi';

COMMENT ON COLUMN public.users.uretim_seansi_beklenir IS
  'Sabah üretim seansı açması beklenen personel — uyarı sisteminde kullanılır';

-- ─── 3. Uyarı tablosu ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.uretim_uyarilari (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tur         TEXT NOT NULL CHECK (tur IN ('seans_acilmadi','seans_uzun_acik','seans_kapanmadi')),
  tarih       DATE NOT NULL,
  hedef_user  TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
  baslik      TEXT NOT NULL,
  detay       JSONB NOT NULL DEFAULT '[]'::jsonb,
  adet        INTEGER NOT NULL DEFAULT 0,
  durum       TEXT NOT NULL DEFAULT 'acik' CHECK (durum IN ('acik','okundu')),
  -- Aynı uyarının gün içinde tekrar üretilmesini engeller
  dedup_key   TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uretim_uyarilari_hedef
  ON public.uretim_uyarilari (hedef_user, tarih DESC) WHERE durum = 'acik';

DROP TRIGGER IF EXISTS set_uretim_uyarilari_updated_at ON public.uretim_uyarilari;
CREATE TRIGGER set_uretim_uyarilari_updated_at
  BEFORE UPDATE ON public.uretim_uyarilari
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.uretim_uyarilari ENABLE ROW LEVEL SECURITY;

-- Kullanıcı yalnızca kendisine hedeflenen uyarıları görür
DROP POLICY IF EXISTS "Kendi uyarilarini oku" ON public.uretim_uyarilari;
CREATE POLICY "Kendi uyarilarini oku"
  ON public.uretim_uyarilari FOR SELECT TO authenticated
  USING (hedef_user IN (SELECT user_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Kendi uyarilarini guncelle" ON public.uretim_uyarilari;
CREATE POLICY "Kendi uyarilarini guncelle"
  ON public.uretim_uyarilari FOR UPDATE TO authenticated
  USING (hedef_user IN (SELECT user_id FROM public.users WHERE auth_id = auth.uid()));

COMMENT ON TABLE public.uretim_uyarilari IS
  'Üretim takip uyarıları — hedef_user alanındaki kişinin dashboard kartında görünür';
