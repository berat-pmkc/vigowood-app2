-- =============================================================
-- 130: Mavi Yaka İş Talimatları + Talepler — temel tablolar
--
-- Bağımlılık: 002/003 (rol + is_admin eşdeğerleri), 20260812090000_depolar,
-- 20260222180000_montaj_sessions, notifications / notification_reads, app_settings.
--
-- Kavramlar:
--   talimat_planlar        haftalık plan (hafta_baslangic = Pazartesi)
--   talimat_satirlar       personel bazlı sıralı iş satırları (sira = öncelik)
--   talimat_yayinlar       "Değişiklikleri yayınla" kayıtları (+ hedef personeller)
--   talimat_onaylar        "Görüldü, anlaşıldı" onayları
--   talimat_guncellik      "Liste güncel" işaretleri
--   talimat_pasifler       personel / liste bazlı pasif aralıkları
--   talepler               üretim talepleri (ofis kullanıcıları açar)
--   talep_revizyonlar      10 dk sonrası düzenleme/kapanış kayıtları
-- Yazma işlemleri RPC'lerle (132/133); doğrudan yazma yalnızca planlayıcıya açık.
-- =============================================================

-- ── Yardımcı fonksiyonlar (SECURITY DEFINER, RLS özyinelemesi yok) ──────────

-- Ofis rolleri: talep açabilen kullanıcılar
CREATE OR REPLACE FUNCTION public.is_office_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND is_active = true
      AND role::text IN (
        'Yönetici', 'Endüstri Mühendisi', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü',
        'Muhasebe', 'Sevkiyat Sorumlusu', 'Pazaryeri Sorumlusu', 'Mimar',
        'Üretim ve Planlama Sorumlusu'
      )
  );
$$;

-- Oturum açmış hesabın users.user_id değeri (istasyon hesabında istasyon hesabının kendisi)
CREATE OR REPLACE FUNCTION public.talimat_kullanici_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.users
  WHERE auth_id = auth.uid()
     OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  ORDER BY (auth_id = auth.uid()) DESC NULLS LAST
  LIMIT 1;
$$;

-- Türkiye saatine göre bugün
CREATE OR REPLACE FUNCTION public.talimat_bugun()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date;
$$;

-- Planlayıcı yetkisi (admin-eşdeğeri + Endüstri Mühendisi)
CREATE OR REPLACE FUNCTION public.talimat_yetki_planlayici()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_engineer() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Ayarlar (app_settings.key='talimat_ayarlari'), eksik anahtarlar varsayılanla tamamlanır
CREATE OR REPLACE FUNCTION public.talimat_ayarlari()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'pasif_gun_saat', jsonb_build_object('gun', 6, 'saat', '17:30'),
           'pazartesi_bildirim_saat', '07:55',
           'hatirlatma_dakika', 10,
           'rapor_dakika', 15
         )
         || COALESCE(
              (SELECT value FROM public.app_settings
               WHERE key = 'talimat_ayarlari' AND jsonb_typeof(value) = 'object'),
              '{}'::jsonb
            );
$$;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('talimat_ayarlari',
   '{"pasif_gun_saat":{"gun":6,"saat":"17:30"},"pazartesi_bildirim_saat":"07:55","hatirlatma_dakika":10,"rapor_dakika":15}'::jsonb,
   'İş talimatı ayarları: pasif_gun_saat (gun: ISO 1=Pzt..7=Paz, saat HH:MM), pazartesi_bildirim_saat, hatirlatma_dakika, rapor_dakika')
ON CONFLICT (key) DO NOTHING;

-- ── TALEPLER ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.talepler (
  talep_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_no        BIGINT GENERATED ALWAYS AS IDENTITY,
  sku             TEXT NOT NULL REFERENCES public.products(sku),
  hedef_depo_id   TEXT REFERENCES public.depolar(depo_id),
  istenen_miktar  NUMERIC CHECK (istenen_miktar IS NULL OR istenen_miktar > 0),
  termin_tarihi   DATE,
  aciklama        TEXT,
  olusturan       TEXT NOT NULL REFERENCES public.users(user_id),
  -- Kapanış (NULL = açık). Ara durumlar (acik/is_emri_verildi/hazirlaniyor/hazir/pasif)
  -- talep_durum görünümünde türetilir.
  kapanis         TEXT CHECK (kapanis IN ('tamamlandi','tamamlanmadi','stokta_mevcut','geri_cekildi')),
  kapanis_neden   TEXT,
  kapanis_at      TIMESTAMPTZ,
  kapatan         TEXT REFERENCES public.users(user_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_talepler_no ON public.talepler (talep_no);
CREATE INDEX IF NOT EXISTS idx_talepler_acik ON public.talepler (created_at) WHERE kapanis IS NULL;
CREATE INDEX IF NOT EXISTS idx_talepler_sku ON public.talepler (sku);
CREATE INDEX IF NOT EXISTS idx_talepler_olusturan ON public.talepler (olusturan);

DROP TRIGGER IF EXISTS set_talepler_updated_at ON public.talepler;
CREATE TRIGGER set_talepler_updated_at
  BEFORE UPDATE ON public.talepler FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.talep_revizyonlar (
  rev_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  talep_id       UUID NOT NULL REFERENCES public.talepler(talep_id) ON DELETE CASCADE,
  yapan          TEXT REFERENCES public.users(user_id),
  islem          TEXT NOT NULL CHECK (islem IN ('guncelle','geri_cek','kapat','stokta_mevcut','yeniden_ac')),
  -- {"alan": {"eski": .., "yeni": ..}}
  degisiklikler  JSONB NOT NULL DEFAULT '{}'::jsonb,
  neden          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talep_revizyonlar_talep ON public.talep_revizyonlar (talep_id, created_at);

-- ── PLANLAR ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.talimat_planlar (
  plan_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hafta_baslangic        DATE NOT NULL UNIQUE
                         CHECK (EXTRACT(ISODOW FROM hafta_baslangic) = 1),
  -- taslak: işçilere görünmez (gelecek hafta hazırlığı); yayinda: aktif; pasif: hafta bitti
  durum                  TEXT NOT NULL DEFAULT 'taslak' CHECK (durum IN ('taslak','yayinda','pasif')),
  yayinlandi_at          TIMESTAMPTZ,
  pasif_at               TIMESTAMPTZ,
  pazartesi_bildirim_at  TIMESTAMPTZ,
  -- Yayınlanmamış silme/sıra değişikliği olan personeller (satır bayrağı bunu taşıyamaz)
  degisen_personeller    TEXT[] NOT NULL DEFAULT '{}',
  kaynak_plan_id         UUID REFERENCES public.talimat_planlar(plan_id) ON DELETE SET NULL,
  olusturan              TEXT REFERENCES public.users(user_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talimat_planlar_durum ON public.talimat_planlar (durum, hafta_baslangic DESC);

DROP TRIGGER IF EXISTS set_talimat_planlar_updated_at ON public.talimat_planlar;
CREATE TRIGGER set_talimat_planlar_updated_at
  BEFORE UPDATE ON public.talimat_planlar FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── SATIRLAR ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.talimat_satirlar (
  satir_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES public.talimat_planlar(plan_id) ON DELETE CASCADE,
  personel_id      TEXT NOT NULL REFERENCES public.users(user_id),
  sira             INTEGER NOT NULL CHECK (sira >= 1),
  istasyon         TEXT CHECK (istasyon IN ('kesim','montaj','paketleme')),
  sku              TEXT REFERENCES public.products(sku),
  plaka_id         TEXT,                       -- plakalar.plaka_id (kesim satırlarında)
  istenen_miktar   NUMERIC CHECK (istenen_miktar IS NULL OR istenen_miktar > 0),
  not_text         TEXT,
  talep_id         UUID REFERENCES public.talepler(talep_id) ON DELETE SET NULL,
  durum            TEXT NOT NULL DEFAULT 'aktif' CHECK (durum IN ('aktif','pasif','tamamlandi')),
  pasif_neden      TEXT,
  pasif_baslangic  DATE,
  pasif_until      DATE,                       -- NULL = elle aktifleştirilene kadar
  -- degisti: yayınlanmamış değişiklik. onay_bekliyor: bildirimli yayın, personel henüz onaylamadı.
  degisti          BOOLEAN NOT NULL DEFAULT false,
  onay_bekliyor    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT talimat_satir_urun_veya_plaka CHECK (sku IS NOT NULL OR plaka_id IS NOT NULL),
  -- Aynı personelde aynı sıra olamaz; yeniden sıralama için transaction sonunda kontrol edilir
  CONSTRAINT uq_talimat_satir_sira UNIQUE (plan_id, personel_id, sira) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_talimat_satirlar_personel ON public.talimat_satirlar (plan_id, personel_id, sira);
CREATE INDEX IF NOT EXISTS idx_talimat_satirlar_talep ON public.talimat_satirlar (talep_id) WHERE talep_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_talimat_satirlar_sku ON public.talimat_satirlar (sku);

DROP TRIGGER IF EXISTS set_talimat_satirlar_updated_at ON public.talimat_satirlar;
CREATE TRIGGER set_talimat_satirlar_updated_at
  BEFORE UPDATE ON public.talimat_satirlar FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── YAYINLAR / HEDEFLER / ONAYLAR ───────────────────────────

CREATE TABLE IF NOT EXISTS public.talimat_yayinlar (
  yayin_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               UUID NOT NULL REFERENCES public.talimat_planlar(plan_id) ON DELETE CASCADE,
  yayinlayan            TEXT REFERENCES public.users(user_id),
  bildirim_gonder       BOOLEAN NOT NULL DEFAULT false,
  sesli                 BOOLEAN NOT NULL DEFAULT false,
  hedef                 TEXT NOT NULL DEFAULT 'degisenler' CHECK (hedef IN ('degisenler','herkes')),
  gonderim_zamani       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- bildirimsiz: sadece yenileme; beklemede: gönderim zamanı gelmedi; gonderildi: hatırlatmalar sürüyor;
  -- tamamlandi: herkes onayladı; durduruldu: hatırlatma kesildi; geri_cekildi: bildirimler de geri çekildi
  durum                 TEXT NOT NULL DEFAULT 'bildirimsiz'
                        CHECK (durum IN ('bildirimsiz','beklemede','gonderildi','tamamlandi','durduruldu','geri_cekildi')),
  ilk_gonderim_at       TIMESTAMPTZ,
  durdurma_at           TIMESTAMPTZ,
  durduran              TEXT REFERENCES public.users(user_id),
  rapor_gonderildi_at   TIMESTAMPTZ,
  otomatik              BOOLEAN NOT NULL DEFAULT false,   -- Pazartesi sabah otomatik yayını
  satir_sayisi          INTEGER NOT NULL DEFAULT 0,
  personel_sayisi       INTEGER NOT NULL DEFAULT 0,
  snapshot              JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talimat_yayinlar_plan ON public.talimat_yayinlar (plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_talimat_yayinlar_aktif ON public.talimat_yayinlar (durum)
  WHERE durum IN ('beklemede','gonderildi');

CREATE TABLE IF NOT EXISTS public.talimat_yayin_hedefler (
  yayin_id          UUID NOT NULL REFERENCES public.talimat_yayinlar(yayin_id) ON DELETE CASCADE,
  personel_id       TEXT NOT NULL REFERENCES public.users(user_id),
  satir_ids         UUID[] NOT NULL DEFAULT '{}',
  son_bildirim_at   TIMESTAMPTZ,
  bildirim_sayisi   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (yayin_id, personel_id)
);
CREATE INDEX IF NOT EXISTS idx_talimat_hedefler_personel ON public.talimat_yayin_hedefler (personel_id);

CREATE TABLE IF NOT EXISTS public.talimat_onaylar (
  yayin_id      UUID NOT NULL REFERENCES public.talimat_yayinlar(yayin_id) ON DELETE CASCADE,
  personel_id   TEXT NOT NULL REFERENCES public.users(user_id),
  onay_zamani   TIMESTAMPTZ NOT NULL DEFAULT now(),
  onaylayan     TEXT REFERENCES public.users(user_id),   -- giriş yapan hesap (istasyon hesabı olabilir)
  PRIMARY KEY (yayin_id, personel_id)
);

CREATE TABLE IF NOT EXISTS public.talimat_guncellik (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id     UUID NOT NULL REFERENCES public.talimat_planlar(plan_id) ON DELETE CASCADE,
  bitis       DATE NOT NULL,                 -- bu tarih dahil "güncel"
  isaretleyen TEXT REFERENCES public.users(user_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talimat_guncellik_plan ON public.talimat_guncellik (plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.talimat_pasifler (
  pasif_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID NOT NULL REFERENCES public.talimat_planlar(plan_id) ON DELETE CASCADE,
  kapsam       TEXT NOT NULL CHECK (kapsam IN ('personel','liste')),
  personel_id  TEXT REFERENCES public.users(user_id),
  baslangic    DATE NOT NULL,
  bitis        DATE NOT NULL DEFAULT 'infinity',
  neden        TEXT,
  olusturan    TEXT REFERENCES public.users(user_id),
  iptal_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT talimat_pasif_personel CHECK ((kapsam = 'personel') = (personel_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_talimat_pasifler_plan ON public.talimat_pasifler (plan_id) WHERE iptal_at IS NULL;

-- ── Seans tablolarına talimat bağı + yardımcı sayısı ────────

ALTER TABLE public.montaj_sessions
  ADD COLUMN IF NOT EXISTS yardimci_sayisi INTEGER NOT NULL DEFAULT 0 CHECK (yardimci_sayisi >= 0),
  ADD COLUMN IF NOT EXISTS talimat_satir_id UUID REFERENCES public.talimat_satirlar(satir_id) ON DELETE SET NULL;
ALTER TABLE public.pack_events
  ADD COLUMN IF NOT EXISTS yardimci_sayisi INTEGER NOT NULL DEFAULT 0 CHECK (yardimci_sayisi >= 0),
  ADD COLUMN IF NOT EXISTS talimat_satir_id UUID REFERENCES public.talimat_satirlar(satir_id) ON DELETE SET NULL;
ALTER TABLE public.cut_batches
  ADD COLUMN IF NOT EXISTS yardimci_sayisi INTEGER NOT NULL DEFAULT 0 CHECK (yardimci_sayisi >= 0),
  ADD COLUMN IF NOT EXISTS talimat_satir_id UUID REFERENCES public.talimat_satirlar(satir_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_montaj_sessions_talimat ON public.montaj_sessions (talimat_satir_id) WHERE talimat_satir_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pack_events_talimat ON public.pack_events (talimat_satir_id) WHERE talimat_satir_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cut_batches_talimat ON public.cut_batches (talimat_satir_id) WHERE talimat_satir_id IS NOT NULL;

-- ── Bildirimler: tür + payload ──────────────────────────────
-- kind: 'genel' (mevcut), 'talimat_degisiklik' (tablet banner), 'talimat_rapor' (planlayıcıya özet)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'genel',
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS sesli BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yayin_id UUID REFERENCES public.talimat_yayinlar(yayin_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS geri_cekildi_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notifications_kind ON public.notifications (kind, created_at DESC) WHERE kind <> 'genel';
CREATE INDEX IF NOT EXISTS idx_notifications_yayin ON public.notifications (yayin_id) WHERE yayin_id IS NOT NULL;

-- ── Ardışık SKU kuralı (doğrudan yazmalara karşı güvenlik ağı) ──
CREATE OR REPLACE FUNCTION public.talimat_ardisik_dogrula(p_plan UUID, p_personel TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku TEXT;
BEGIN
  SELECT x.sku INTO v_sku
  FROM (
    SELECT sku, lag(sku) OVER (ORDER BY sira) AS onceki
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND personel_id = p_personel
  ) x
  WHERE x.sku IS NOT NULL AND x.sku = x.onceki
  LIMIT 1;

  IF v_sku IS NOT NULL THEN
    RAISE EXCEPTION 'ARDISIK_SKU: Aynı personele art arda iki öncelikte aynı ürün verilemez (%)', v_sku
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_ardisik_tetikleyici()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talimat_ardisik_dogrula(NEW.plan_id, NEW.personel_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_talimat_ardisik ON public.talimat_satirlar;
CREATE CONSTRAINT TRIGGER trg_talimat_ardisik
  AFTER INSERT OR UPDATE OF sku, sira, personel_id, plan_id ON public.talimat_satirlar
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.talimat_ardisik_tetikleyici();

-- ── RLS ─────────────────────────────────────────────────────
-- Okuma: üretim erişimi (operatör/hat/planlayıcı) + ofis rolleri.
-- Yazma: planlayıcı (is_admin_or_engineer). Onay/talep işlemleri RPC üzerinden.
ALTER TABLE public.talimat_planlar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_satirlar       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_yayinlar       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_yayin_hedefler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_onaylar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_guncellik      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talimat_pasifler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talepler               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talep_revizyonlar      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['talimat_planlar','talimat_satirlar','talimat_yayinlar',
                           'talimat_yayin_hedefler','talimat_onaylar','talimat_guncellik',
                           'talimat_pasifler','talepler','talep_revizyonlar']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_production_access() OR public.is_office_user())',
      t || '_select', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['talimat_planlar','talimat_satirlar','talimat_yayinlar',
                           'talimat_yayin_hedefler','talimat_guncellik','talimat_pasifler']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_planlayici', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_or_engineer()) WITH CHECK (public.is_admin_or_engineer())',
      t || '_planlayici', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS talimat_onaylar_admin_sil ON public.talimat_onaylar;
CREATE POLICY talimat_onaylar_admin_sil ON public.talimat_onaylar
  FOR DELETE TO authenticated USING (public.is_admin_or_engineer());

DROP POLICY IF EXISTS talepler_insert ON public.talepler;
CREATE POLICY talepler_insert ON public.talepler
  FOR INSERT TO authenticated
  WITH CHECK (public.is_office_user() AND olusturan = public.talimat_kullanici_id());

DROP POLICY IF EXISTS talepler_update ON public.talepler;
CREATE POLICY talepler_update ON public.talepler
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_engineer()
         OR (public.is_office_user() AND olusturan = public.talimat_kullanici_id()))
  WITH CHECK (public.is_admin_or_engineer()
         OR (public.is_office_user() AND olusturan = public.talimat_kullanici_id()));

DROP POLICY IF EXISTS talepler_delete ON public.talepler;
CREATE POLICY talepler_delete ON public.talepler
  FOR DELETE TO authenticated
  USING (public.is_admin_or_engineer()
         OR (olusturan = public.talimat_kullanici_id() AND created_at > now() - interval '10 minutes'));

DROP POLICY IF EXISTS talep_revizyonlar_admin ON public.talep_revizyonlar;
CREATE POLICY talep_revizyonlar_admin ON public.talep_revizyonlar
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── Realtime ────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['talimat_planlar','talimat_satirlar','talimat_yayinlar','talimat_onaylar','talepler']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ── Yetkiler ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.is_office_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_office_user() TO authenticated;
REVOKE ALL ON FUNCTION public.talimat_kullanici_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_kullanici_id() TO authenticated;
REVOKE ALL ON FUNCTION public.talimat_yetki_planlayici() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_yetki_planlayici() TO authenticated;
REVOKE ALL ON FUNCTION public.talimat_ayarlari() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_ayarlari() TO authenticated;
GRANT EXECUTE ON FUNCTION public.talimat_bugun() TO authenticated;
REVOKE ALL ON FUNCTION public.talimat_ardisik_dogrula(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_ardisik_dogrula(UUID, TEXT) TO authenticated;
