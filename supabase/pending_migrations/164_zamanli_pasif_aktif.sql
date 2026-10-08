-- 164: Zamanlı pasif / aktif işlemleri (gün-saat seçerek pasif et / aktif et, iş sırası, yayın seçeneği)
-- * talimat_zamanli_islemler: bekleyen/yapılan zamanlı işlemler. Yazma yalnız RPC üzerinden (SECURITY DEFINER).
-- * talimat_pasif_ic / talimat_pasif_kaldir_ic: yetki kontrolsüz iç sürümler (163 gövdeleri); dış talimat_pasif /
--   talimat_pasif_kaldir artık yalnızca yetki kontrolü + iç sürümü çağırır (imzalar değişmedi).
-- * talimat_zamanli_islem_calistir(id): iç; pasif/aktif uygular, aktif satırı görünen sıraya taşır, isteğe bağlı yayınlar.
-- * talimat_zamanlayici(): 161 tanımı + zamanı gelen 'bekliyor' işlemleri çalıştırır.

CREATE TABLE IF NOT EXISTS public.talimat_zamanli_islemler (
  islem_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES public.talimat_planlar(plan_id) ON DELETE CASCADE,
  kapsam         TEXT NOT NULL CHECK (kapsam IN ('satir', 'hat', 'liste')),
  ids            TEXT[] NOT NULL DEFAULT '{}',        -- satir: satır uuid'leri, hat: hat uuid'leri, liste: boş
  islem          TEXT NOT NULL CHECK (islem IN ('pasif', 'aktif')),
  calisma_zamani TIMESTAMPTZ NOT NULL DEFAULT now(),
  hedef_sira     INTEGER CHECK (hedef_sira IS NULL OR hedef_sira >= 1),  -- aktif satır: hattın aktif satırları arasındaki görünen konum; NULL = aktiflerin sonu
  pasif_neden    TEXT,
  pasif_bitis    DATE,
  yayin          TEXT NOT NULL DEFAULT 'yok' CHECK (yayin IN ('yok', 'bildirimsiz', 'bildirimli')),
  sesli          BOOLEAN NOT NULL DEFAULT false,
  durum          TEXT NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'yapildi', 'iptal', 'hata')),
  hata           TEXT,
  olusturan      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  calisti_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS talimat_zamanli_islemler_bekleyen_idx
  ON public.talimat_zamanli_islemler (calisma_zamani) WHERE durum = 'bekliyor';
CREATE INDEX IF NOT EXISTS talimat_zamanli_islemler_plan_idx
  ON public.talimat_zamanli_islemler (plan_id, created_at DESC);

ALTER TABLE public.talimat_zamanli_islemler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talimat_zamanli_islemler_select ON public.talimat_zamanli_islemler;
CREATE POLICY talimat_zamanli_islemler_select ON public.talimat_zamanli_islemler
  FOR SELECT TO authenticated USING (public.is_admin_or_engineer());
-- INSERT/UPDATE/DELETE politikası yok: yazma yalnızca RPC (SECURITY DEFINER) ile
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.talimat_zamanli_islemler FROM anon, authenticated;

-- Aktif satırı, hattının aktif (pasif olmayan, tamamlanmamış) satırları arasındaki görünen konuma taşır.
-- p_gorunen aktif satır sayısından büyükse son aktif satırın arkasına gider.
CREATE OR REPLACE FUNCTION public.talimat_satir_gorunen_sira_ic(p_plan UUID, p_satir UUID, p_gorunen INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hat UUID;
  v_per TEXT;
  v_abs INTEGER;
BEGIN
  SELECT hat_id, personel_id INTO v_hat, v_per FROM public.talimat_satirlar
  WHERE satir_id = p_satir AND plan_id = p_plan;
  IF NOT FOUND OR v_hat IS NULL OR p_gorunen IS NULL THEN RETURN; END IF;

  WITH diger AS (
    SELECT s.satir_id, row_number() OVER (ORDER BY s.sira, s.created_at) AS r, s.durum, i.etkin_durum
    FROM public.talimat_satirlar s
    LEFT JOIN public.talimat_satir_ilerleme i ON i.satir_id = s.satir_id
    WHERE s.plan_id = p_plan AND s.hat_id = v_hat AND s.satir_id <> p_satir
  ),
  gor AS (
    SELECT r, row_number() OVER (ORDER BY r) AS g FROM diger
    WHERE durum <> 'pasif' AND COALESCE(etkin_durum, '') <> 'tamamlandi'
  )
  SELECT COALESCE(
           (SELECT r FROM gor WHERE g = p_gorunen),
           (SELECT COALESCE(max(r), 0) + 1 FROM diger WHERE durum <> 'pasif'))
    INTO v_abs;

  PERFORM public.talimat_sira_yerlestir_g(p_plan, v_hat, v_per, p_satir, v_abs);
END;
$$;

-- ── İç sürümler (yetki kontrolü yok; zamanlayıcı da çağırır) ──
CREATE OR REPLACE FUNCTION public.talimat_pasif_ic(
  p_kapsam TEXT, p_plan UUID, p_ids TEXT[], p_baslangic DATE, p_bitis DATE, p_neden TEXT, p_olusturan TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.talimat_planlar%ROWTYPE;
  v_bas DATE := COALESCE(p_baslangic, public.talimat_bugun());
  v_n INTEGER := 0;
  v_p TEXT;
  v_yeni_pasif UUID[] := '{}';
BEGIN
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  IF p_bitis IS NOT NULL AND p_bitis < v_bas THEN RAISE EXCEPTION 'Bitiş tarihi başlangıçtan önce olamaz'; END IF;

  IF p_kapsam = 'satir' THEN
    -- Şimdiye dek pasif olmayanlar: hattın en altına gidecek (163)
    SELECT COALESCE(array_agg(satir_id), '{}') INTO v_yeni_pasif FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND hat_id IS NOT NULL AND durum <> 'pasif';
    UPDATE public.talimat_satirlar
    SET durum = 'pasif', pasif_neden = NULLIF(btrim(p_neden), ''), pasif_baslangic = v_bas,
        pasif_until = p_bitis, degisti = degisti OR (v_plan.durum = 'yayinda')
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM public.talimat_hat_yeniden_sirala_satirlar(p_plan, v_yeni_pasif, true);
  ELSIF p_kapsam = 'personel' THEN
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      INSERT INTO public.talimat_pasifler (plan_id, kapsam, personel_id, baslangic, bitis, neden, olusturan)
      VALUES (p_plan, 'personel', v_p, v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
              p_olusturan);
      v_n := v_n + 1;
      PERFORM public.talimat_degisen_isaretle(p_plan, v_p);
    END LOOP;
  ELSIF p_kapsam = 'hat' THEN
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = v_p::uuid) THEN
        RAISE EXCEPTION 'Hat bulunamadı: %', v_p;
      END IF;
      INSERT INTO public.talimat_pasifler (plan_id, kapsam, hat_id, baslangic, bitis, neden, olusturan)
      VALUES (p_plan, 'hat', v_p::uuid, v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
              p_olusturan);
      v_n := v_n + 1;
      PERFORM public.talimat_degisen_grup_isaretle(p_plan, v_p::uuid, NULL);
    END LOOP;
  ELSIF p_kapsam = 'liste' THEN
    INSERT INTO public.talimat_pasifler (plan_id, kapsam, baslangic, bitis, neden, olusturan)
    VALUES (p_plan, 'liste', v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
            p_olusturan);
    v_n := 1;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|hat|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_pasif_kaldir_ic(p_kapsam TEXT, p_plan UUID, p_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
  v_n INTEGER := 0;
  v_p TEXT;
  v_aktif UUID[] := '{}';
BEGIN
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF v_yayinda IS NULL THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;

  IF p_kapsam = 'satir' THEN
    WITH u AS (
      UPDATE public.talimat_satirlar
      SET durum = 'aktif', pasif_neden = NULL, pasif_baslangic = NULL, pasif_until = NULL,
          degisti = degisti OR v_yayinda
      WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND durum = 'pasif'
      RETURNING satir_id
    )
    SELECT COALESCE(array_agg(satir_id), '{}'), count(*) INTO v_aktif, v_n FROM u;
    -- Yeniden aktif olanlar aktiflerin sonuna (163)
    PERFORM public.talimat_hat_yeniden_sirala_satirlar(p_plan, v_aktif, false);
  ELSIF p_kapsam = 'personel' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'personel' AND personel_id = ANY (p_ids) AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'hat' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'hat' AND hat_id = ANY (p_ids::uuid[]) AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      PERFORM public.talimat_degisen_grup_isaretle(p_plan, v_p::uuid, NULL);
    END LOOP;
  ELSIF p_kapsam = 'liste' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'liste' AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|hat|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

-- ── Dış (yetkili) sürümler: eski imzalar korunur ───────────────
CREATE OR REPLACE FUNCTION public.talimat_pasif(
  p_kapsam TEXT, p_plan UUID, p_ids TEXT[], p_baslangic DATE, p_bitis DATE, p_neden TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  RETURN public.talimat_pasif_ic(p_kapsam, p_plan, p_ids, p_baslangic, p_bitis, p_neden, public.talimat_kullanici_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_pasif_kaldir(p_kapsam TEXT, p_plan UUID, p_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  RETURN public.talimat_pasif_kaldir_ic(p_kapsam, p_plan, p_ids);
END;
$$;

-- ── Zamanlayıcı (161 tanımı + zamanlı işlemler) ──
CREATE OR REPLACE FUNCTION public.talimat_zamanlayici()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ay        JSONB := public.talimat_ayarlari();
  v_gun       INTEGER := COALESCE((v_ay -> 'pasif_gun_saat' ->> 'gun')::integer, 6);
  v_saat      TIME := COALESCE((v_ay -> 'pasif_gun_saat' ->> 'saat')::time, '17:30'::time);
  v_pzt_saat  TIME := COALESCE((v_ay ->> 'pazartesi_bildirim_saat')::time, '07:55'::time);
  v_hatirlat  INTEGER := GREATEST(COALESCE((v_ay ->> 'hatirlatma_dakika')::integer, 10), 1);
  v_rapor     INTEGER := GREATEST(COALESCE((v_ay ->> 'rapor_dakika')::integer, 15), 1);
  v_simdi     TIMESTAMP := now() AT TIME ZONE 'Europe/Istanbul';
  v_bugun     DATE := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_pasif_n   INTEGER := 0;
  v_pzt_n     INTEGER := 0;
  v_gonder_n  INTEGER := 0;
  v_hatirlat_n INTEGER := 0;
  v_rapor_n   INTEGER := 0;
  v_zamanli_n INTEGER := 0;
  r           RECORD;
  v_adlar     TEXT;
  v_liste     JSONB;
  v_say       INTEGER;
BEGIN
  -- Aynı anda iki çalışma olmasın
  IF NOT pg_try_advisory_xact_lock(hashtext('talimat_zamanlayici')) THEN
    RETURN jsonb_build_object('atlandi', true);
  END IF;

  -- 1) Otomatik pasif: hafta_baslangic + (gun-1) günü, saat'ten itibaren (veya hafta tamamen geçtiyse)
  FOR r IN
    SELECT plan_id FROM public.talimat_planlar
    WHERE durum = 'yayinda'
      AND (hafta_baslangic + (v_gun - 1)) + v_saat <= v_simdi
  LOOP
    UPDATE public.talimat_planlar SET durum = 'pasif', pasif_at = now() WHERE plan_id = r.plan_id;
    UPDATE public.talimat_yayinlar SET durum = 'durduruldu', durdurma_at = now()
    WHERE plan_id = r.plan_id AND durum IN ('beklemede', 'gonderildi');
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE kind = 'talimat_degisiklik' AND geri_cekildi_at IS NULL
      AND yayin_id IN (SELECT yayin_id FROM public.talimat_yayinlar WHERE plan_id = r.plan_id);
    UPDATE public.talimat_satirlar SET onay_bekliyor = false WHERE plan_id = r.plan_id AND onay_bekliyor;
    v_pasif_n := v_pasif_n + 1;
  END LOOP;

  -- 1b) Zamanı gelen zamanlı pasif/aktif işlemleri (164)
  FOR r IN
    SELECT islem_id FROM public.talimat_zamanli_islemler
    WHERE durum = 'bekliyor' AND calisma_zamani <= now()
    ORDER BY calisma_zamani, created_at
  LOOP
    BEGIN
      PERFORM public.talimat_zamanli_islem_calistir(r.islem_id);
      v_zamanli_n := v_zamanli_n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'zamanlı işlem başarısız (%): %', r.islem_id, SQLERRM;
    END;
  END LOOP;

  -- 2) Pazartesi sabahı otomatik bildirim (bu haftanın yayındaki planı, bir kez)
  IF v_simdi::time >= v_pzt_saat THEN
    FOR r IN
      SELECT plan_id FROM public.talimat_planlar
      WHERE durum = 'yayinda' AND hafta_baslangic = v_bugun AND pazartesi_bildirim_at IS NULL
    LOOP
      -- Yayın başarısız olsa (ör. boş plan) tekrar denenmesin
      UPDATE public.talimat_planlar SET pazartesi_bildirim_at = now() WHERE plan_id = r.plan_id;
      BEGIN
        PERFORM public.talimat_yayinla_ic(r.plan_id, true, now(), true, 'herkes', NULL, true);
        v_pzt_n := v_pzt_n + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'talimat pazartesi bildirimi başarısız (plan %): %', r.plan_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- 3) Zamanı gelen planlı gönderimler (personel + hat hedefleri)
  FOR r IN
    SELECT y.yayin_id FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'beklemede' AND y.bildirim_gonder AND y.gonderim_zamani <= now()
      AND p.durum <> 'pasif'
  LOOP
    PERFORM public.talimat_bildirim_gonder_ic(r.yayin_id, false, NULL);
    PERFORM public.talimat_bildirim_gonder_hat_ic(r.yayin_id, false, NULL);
    UPDATE public.talimat_yayinlar SET durum = 'gonderildi', ilk_gonderim_at = now() WHERE yayin_id = r.yayin_id;
    v_gonder_n := v_gonder_n + 1;
  END LOOP;

  -- 4a) Hatırlatmalar (eski personel hedefleri)
  FOR r IN
    SELECT y.yayin_id,
           array_agg(h.personel_id) AS personeller
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.hat_id IS NULL
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.hat_id IS NULL AND o.personel_id = h.personel_id)
      AND COALESCE(h.son_bildirim_at, y.ilk_gonderim_at, y.gonderim_zamani)
            <= now() - make_interval(mins => v_hatirlat)
    GROUP BY y.yayin_id
  LOOP
    v_hatirlat_n := v_hatirlat_n + public.talimat_bildirim_gonder_ic(r.yayin_id, true, r.personeller);
  END LOOP;

  -- 4b) Hatırlatmalar (hat hedefleri): onaylamayan her hata, son bildirimden hatirlatma_dakika sonra
  FOR r IN
    SELECT y.yayin_id,
           array_agg(h.hat_id) AS hatlar
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.hat_id IS NOT NULL
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
      AND COALESCE(h.son_bildirim_at, y.ilk_gonderim_at, y.gonderim_zamani)
            <= now() - make_interval(mins => v_hatirlat)
    GROUP BY y.yayin_id
  LOOP
    v_hatirlat_n := v_hatirlat_n + public.talimat_bildirim_gonder_hat_ic(r.yayin_id, true, r.hatlar);
  END LOOP;

  -- 5) Planlayıcıya özet: ilk gönderimden rapor_dakika sonra, hâlâ onaylamayan (hat veya personel) varsa (bir kez)
  FOR r IN
    SELECT y.yayin_id, y.plan_id, COALESCE(y.yayinlayan, p.olusturan) AS alici, p.hafta_baslangic
    FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder AND y.rapor_gonderildi_at IS NULL
      AND y.ilk_gonderim_at <= now() - make_interval(mins => v_rapor)
  LOOP
    SELECT string_agg(x.ad, ', ' ORDER BY x.ad), jsonb_agg(x.j ORDER BY x.ad), count(*)::integer
      INTO v_adlar, v_liste, v_say
    FROM (
      SELECT u.full_name AS ad, jsonb_build_object('personel_id', u.user_id, 'ad', u.full_name) AS j
      FROM public.talimat_yayin_hedefler h
      JOIN public.users u ON u.user_id = h.personel_id
      WHERE h.yayin_id = r.yayin_id AND h.hat_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.hat_id IS NULL AND o.personel_id = h.personel_id)
      UNION ALL
      SELECT ht.ad, jsonb_build_object('hat_id', ht.hat_id, 'ad', ht.ad)
      FROM public.talimat_yayin_hedefler h
      JOIN public.talimat_hatlar ht ON ht.hat_id = h.hat_id
      WHERE h.yayin_id = r.yayin_id
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
    ) x;

    UPDATE public.talimat_yayinlar SET rapor_gonderildi_at = now() WHERE yayin_id = r.yayin_id;

    IF v_liste IS NOT NULL AND r.alici IS NOT NULL THEN
      INSERT INTO public.notifications
        (notif_id, title, message, target_user, status, created_by, kind, payload, sesli, yayin_id)
      VALUES (
        'TLR-' || to_char(clock_timestamp() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDDHH24MISSMS')
          || '-' || r.alici || '-' || substr(md5(random()::text), 1, 4),
        'İş talimatını henüz onaylamayan hat/personel var',
        v_say || ' kayıt ' || v_rapor || ' dakikadır onaylamadı: ' || v_adlar,
        r.alici, 'Yeni', 'sistem', 'talimat_rapor',
        jsonb_build_object('yayin_id', r.yayin_id, 'plan_id', r.plan_id, 'onaylamayanlar', v_liste),
        false, r.yayin_id);
      v_rapor_n := v_rapor_n + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pasif_plan', v_pasif_n, 'pazartesi_bildirim', v_pzt_n, 'planli_gonderim', v_gonder_n,
    'hatirlatma', v_hatirlat_n, 'rapor', v_rapor_n, 'zamanli_islem', v_zamanli_n);
END;
$$;

-- ── Zamanlı işlemi çalıştır (iç) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.talimat_zamanli_islem_calistir(p_islem UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i     public.talimat_zamanli_islemler%ROWTYPE;
  v_plan  public.talimat_planlar%ROWTYPE;
  v_n     INTEGER := 0;
  v_idx   INTEGER := 0;
  v_id    TEXT;
  v_uyari TEXT;
BEGIN
  SELECT * INTO v_i FROM public.talimat_zamanli_islemler WHERE islem_id = p_islem FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zamanlı işlem bulunamadı'; END IF;
  IF v_i.durum <> 'bekliyor' THEN
    RETURN jsonb_build_object('islem_id', p_islem, 'durum', v_i.durum, 'hata', v_i.hata);
  END IF;

  BEGIN
    SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_i.plan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
    IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

    IF v_i.islem = 'pasif' THEN
      v_n := public.talimat_pasif_ic(v_i.kapsam, v_i.plan_id, v_i.ids, public.talimat_bugun(), v_i.pasif_bitis,
                                     v_i.pasif_neden, v_i.olusturan);
    ELSE
      v_n := public.talimat_pasif_kaldir_ic(v_i.kapsam, v_i.plan_id, v_i.ids);
      IF v_i.kapsam = 'satir' AND v_i.hedef_sira IS NOT NULL THEN
        FOREACH v_id IN ARRAY v_i.ids LOOP
          PERFORM public.talimat_satir_gorunen_sira_ic(v_i.plan_id, v_id::uuid, v_i.hedef_sira + v_idx);
          v_idx := v_idx + 1;
        END LOOP;
      END IF;
    END IF;

    UPDATE public.talimat_zamanli_islemler SET durum = 'yapildi', calisti_at = now(), hata = NULL
    WHERE islem_id = p_islem;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.talimat_zamanli_islemler SET durum = 'hata', calisti_at = now(), hata = SQLERRM
    WHERE islem_id = p_islem;
    RETURN jsonb_build_object('islem_id', p_islem, 'durum', 'hata', 'hata', SQLERRM);
  END;

  -- Yayın ayrı blokta: başarısız olsa bile pasif/aktif değişikliği korunur
  IF v_i.yayin <> 'yok' THEN
    BEGIN
      PERFORM public.talimat_yayinla_ic(v_i.plan_id, v_i.yayin = 'bildirimli', now(), v_i.sesli, 'degisenler',
                                        v_i.olusturan, false);
    EXCEPTION WHEN OTHERS THEN
      v_uyari := 'Yayın yapılamadı: ' || SQLERRM;
      UPDATE public.talimat_zamanli_islemler SET hata = v_uyari WHERE islem_id = p_islem;
    END;
  END IF;

  RETURN jsonb_build_object('islem_id', p_islem, 'durum', 'yapildi', 'etkilenen', v_n, 'hata', v_uyari);
END;
$$;

-- ── Zamanlı işlem ekle (planlayıcı) ────────────────────────────
-- p_zaman NULL veya <= now(): hemen uygulanır. Hemen uygulanırken hata olursa istisna fırlatılır (kayıt oluşmaz).
CREATE OR REPLACE FUNCTION public.talimat_zamanli_islem_ekle(
  p_plan UUID, p_kapsam TEXT, p_ids TEXT[], p_islem TEXT, p_zaman TIMESTAMPTZ DEFAULT NULL,
  p_hedef_sira INTEGER DEFAULT NULL, p_neden TEXT DEFAULT NULL, p_bitis DATE DEFAULT NULL,
  p_yayin TEXT DEFAULT 'yok', p_sesli BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan    public.talimat_planlar%ROWTYPE;
  v_id      UUID;
  v_ids     TEXT[] := COALESCE(p_ids, '{}');
  v_zaman   TIMESTAMPTZ := COALESCE(p_zaman, now());
  v_hemen   BOOLEAN;
  v_sonuc   JSONB;
  v_say     INTEGER;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  IF p_kapsam NOT IN ('satir', 'hat', 'liste') THEN RAISE EXCEPTION 'Geçersiz kapsam: % (satir|hat|liste)', p_kapsam; END IF;
  IF p_islem NOT IN ('pasif', 'aktif') THEN RAISE EXCEPTION 'Geçersiz işlem: % (pasif|aktif)', p_islem; END IF;
  IF COALESCE(p_yayin, 'yok') NOT IN ('yok', 'bildirimsiz', 'bildirimli') THEN
    RAISE EXCEPTION 'Geçersiz yayın seçeneği: %', p_yayin;
  END IF;
  IF p_kapsam = 'liste' THEN
    v_ids := '{}';
  ELSE
    IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'Kayıt seçilmedi'; END IF;
    IF p_kapsam = 'satir' THEN
      SELECT count(*) INTO v_say FROM public.talimat_satirlar WHERE plan_id = p_plan AND satir_id = ANY (v_ids::uuid[]);
      IF v_say <> cardinality(v_ids) THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
    ELSE
      SELECT count(*) INTO v_say FROM public.talimat_hatlar WHERE hat_id = ANY (v_ids::uuid[]);
      IF v_say <> cardinality(v_ids) THEN RAISE EXCEPTION 'Hat bulunamadı'; END IF;
    END IF;
  END IF;
  IF p_hedef_sira IS NOT NULL AND p_hedef_sira < 1 THEN RAISE EXCEPTION 'İş sırası 1 veya daha büyük olmalı'; END IF;
  IF p_bitis IS NOT NULL AND p_bitis < (v_zaman AT TIME ZONE 'Europe/Istanbul')::date THEN
    RAISE EXCEPTION 'Bitiş tarihi başlangıçtan önce olamaz';
  END IF;

  v_hemen := v_zaman <= now();
  INSERT INTO public.talimat_zamanli_islemler
    (plan_id, kapsam, ids, islem, calisma_zamani, hedef_sira, pasif_neden, pasif_bitis, yayin, sesli, olusturan)
  VALUES
    (p_plan, p_kapsam, v_ids, p_islem, v_zaman,
     CASE WHEN p_islem = 'aktif' AND p_kapsam = 'satir' THEN p_hedef_sira END,
     CASE WHEN p_islem = 'pasif' THEN NULLIF(btrim(p_neden), '') END,
     CASE WHEN p_islem = 'pasif' THEN p_bitis END,
     COALESCE(p_yayin, 'yok'), COALESCE(p_sesli, false), public.talimat_kullanici_id())
  RETURNING islem_id INTO v_id;

  IF v_hemen THEN
    v_sonuc := public.talimat_zamanli_islem_calistir(v_id);
    IF v_sonuc ->> 'durum' = 'hata' THEN
      RAISE EXCEPTION '%', v_sonuc ->> 'hata';
    END IF;
    RETURN v_sonuc;
  END IF;
  RETURN jsonb_build_object('islem_id', v_id, 'durum', 'bekliyor');
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_zamanli_islem_iptal(p_islem UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  UPDATE public.talimat_zamanli_islemler SET durum = 'iptal', calisti_at = now()
  WHERE islem_id = p_islem AND durum = 'bekliyor';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

-- ── Yetkiler ──────────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'talimat_zamanli_islem_ekle(uuid,text,text[],text,timestamptz,integer,text,date,text,boolean)',
    'talimat_zamanli_islem_iptal(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'talimat_pasif_ic(text,uuid,text[],date,date,text,text)',
    'talimat_pasif_kaldir_ic(text,uuid,text[])',
    'talimat_satir_gorunen_sira_ic(uuid,uuid,integer)',
    'talimat_zamanli_islem_calistir(uuid)',
    'talimat_zamanlayici()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
