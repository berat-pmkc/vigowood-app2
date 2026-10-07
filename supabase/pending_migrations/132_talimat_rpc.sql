-- =============================================================
-- 132: İş talimatı RPC'leri (SECURITY DEFINER, doğrulamalı)
--
-- Genel kural: planlayıcı işlemleri talimat_yetki_planlayici() ile korunur
-- (is_admin_or_engineer). "_ic" ile biten fonksiyonlar yalnızca diğer
-- fonksiyonlar / pg_cron içindir, istemciye açılmaz.
-- Hata kodları mesajın başında: ARDISIK_SKU, SIRA_DOLU, PLAN_PASIF.
-- =============================================================

-- ── Sıra yardımcıları ─────────────────────────────────────────

-- Personelin satırlarını 1..n sıkıştırır. p_satir verilirse o satırı p_hedef konumuna yerleştirir
-- (diğerleri kaydırılır). Sırası değişen satırlar yayınlanmış planda degisti=true olur.
CREATE OR REPLACE FUNCTION public.talimat_sira_yerlestir(
  p_plan UUID, p_personel TEXT, p_satir UUID DEFAULT NULL, p_hedef INTEGER DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
BEGIN
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;

  WITH diger AS (
    SELECT satir_id, row_number() OVER (ORDER BY sira, created_at) AS r
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND personel_id = p_personel
      AND satir_id IS DISTINCT FROM p_satir
  ),
  hepsi AS (
    SELECT satir_id, r::numeric AS k FROM diger
    UNION ALL
    SELECT p_satir,
           LEAST(GREATEST(COALESCE(p_hedef, 1), 1), (SELECT count(*) + 1 FROM diger))::numeric - 0.5
    WHERE p_satir IS NOT NULL
  ),
  sirali AS (
    SELECT satir_id, row_number() OVER (ORDER BY k) AS yeni FROM hepsi
  )
  UPDATE public.talimat_satirlar s
  SET sira = sirali.yeni,
      degisti = s.degisti OR (COALESCE(v_yayinda, false) AND s.sira <> sirali.yeni)
  FROM sirali
  WHERE s.satir_id = sirali.satir_id AND s.sira <> sirali.yeni;
END;
$$;

-- Yayınlanmamış değişikliği olan personeli plana işle (silme/sıra değişikliği için)
CREATE OR REPLACE FUNCTION public.talimat_degisen_isaretle(p_plan UUID, p_personel TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.talimat_planlar
  SET degisen_personeller = array_append(degisen_personeller, p_personel)
  WHERE plan_id = p_plan AND durum = 'yayinda'
    AND NOT (p_personel = ANY (degisen_personeller));
$$;

-- ── Plan ──────────────────────────────────────────────────────

-- Haftanın planını getirir, yoksa taslak oluşturur. p_hafta herhangi bir gün olabilir (Pazartesi'ye çekilir).
CREATE OR REPLACE FUNCTION public.talimat_plan_getir_veya_olustur(p_hafta DATE DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hafta DATE := date_trunc('week', COALESCE(p_hafta, public.talimat_bugun())::timestamp)::date;
  v_id UUID;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT plan_id INTO v_id FROM public.talimat_planlar WHERE hafta_baslangic = v_hafta;
  IF v_id IS NULL THEN
    INSERT INTO public.talimat_planlar (hafta_baslangic, durum, olusturan)
    VALUES (v_hafta, 'taslak', public.talimat_kullanici_id())
    RETURNING plan_id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- Bir haftanın planını (tüm satırlar) başka haftaya kopyalar. Hedef plan yoksa taslak oluşturulur;
-- varsa ve boşsa kullanılır, doluysa hata verilir. Pasif/tamamlandı durumları 'aktif'e döner,
-- istenen miktar, not, talep bağı ve sıra korunur; yayın/onay izleri kopyalanmaz.
CREATE OR REPLACE FUNCTION public.talimat_kopyala_hafta(p_kaynak_plan UUID, p_hedef_hafta DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hafta DATE := date_trunc('week', p_hedef_hafta::timestamp)::date;
  v_hedef UUID;
  v_n INTEGER;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF NOT EXISTS (SELECT 1 FROM public.talimat_planlar WHERE plan_id = p_kaynak_plan) THEN
    RAISE EXCEPTION 'Kaynak plan bulunamadı';
  END IF;

  SELECT plan_id INTO v_hedef FROM public.talimat_planlar WHERE hafta_baslangic = v_hafta;
  IF v_hedef IS NULL THEN
    INSERT INTO public.talimat_planlar (hafta_baslangic, durum, olusturan, kaynak_plan_id)
    VALUES (v_hafta, 'taslak', public.talimat_kullanici_id(), p_kaynak_plan)
    RETURNING plan_id INTO v_hedef;
  ELSE
    IF v_hedef = p_kaynak_plan THEN RAISE EXCEPTION 'Plan kendi üzerine kopyalanamaz'; END IF;
    SELECT count(*) INTO v_n FROM public.talimat_satirlar WHERE plan_id = v_hedef;
    IF v_n > 0 THEN RAISE EXCEPTION 'Hedef haftanın planı dolu, kopyalanamaz'; END IF;
    IF (SELECT durum FROM public.talimat_planlar WHERE plan_id = v_hedef) = 'pasif' THEN
      RAISE EXCEPTION 'PLAN_PASIF: Hedef plan pasif';
    END IF;
  END IF;

  INSERT INTO public.talimat_satirlar
    (plan_id, personel_id, sira, istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id, durum, degisti)
  SELECT v_hedef, s.personel_id, s.sira, s.istasyon, s.sku, s.plaka_id, s.istenen_miktar,
         s.not_text, s.talep_id, 'aktif',
         COALESCE((SELECT pp.durum = 'yayinda' FROM public.talimat_planlar pp WHERE pp.plan_id = v_hedef), false)
  FROM public.talimat_satirlar s
  WHERE s.plan_id = p_kaynak_plan
    AND (s.personel_id IN (SELECT user_id FROM public.users WHERE is_active = true));

  RETURN v_hedef;
END;
$$;

-- ── Satır CRUD ────────────────────────────────────────────────

-- p (jsonb) anahtarları: satir_id (güncelleme), plan_id (yeni satır), personel_id, sira, kaydir,
-- istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id, durum, pasif_neden, pasif_baslangic, pasif_until.
-- Anahtar yoksa alan değişmez; anahtar null ise alan temizlenir.
-- Yeni satırda sira dolu bir konumsa: kaydir=true -> araya girer, değilse SIRA_DOLU hatası.
-- sira verilmezse personelin listesinin sonuna eklenir.
CREATE OR REPLACE FUNCTION public.talimat_satir_kaydet(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          UUID := NULLIF(p ->> 'satir_id', '')::uuid;
  v_eski        public.talimat_satirlar%ROWTYPE;
  v_plan        public.talimat_planlar%ROWTYPE;
  v_plan_id     UUID;
  v_personel    TEXT;
  v_sku         TEXT;
  v_plaka       TEXT;
  v_ist         TEXT;
  v_miktar      NUMERIC;
  v_not         TEXT;
  v_talep       UUID;
  v_durum       TEXT;
  v_pneden      TEXT;
  v_pbas        DATE;
  v_puntil      DATE;
  v_sira        INTEGER := NULLIF(p ->> 'sira', '')::integer;
  v_kaydir      BOOLEAN := COALESCE((p ->> 'kaydir')::boolean, false);
  v_yayinda     BOOLEAN;
  v_degisti     BOOLEAN := false;
  v_n           INTEGER;
  v_personel_degisti BOOLEAN := false;
BEGIN
  PERFORM public.talimat_yetki_planlayici();

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_eski FROM public.talimat_satirlar WHERE satir_id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
    v_plan_id := v_eski.plan_id;
  ELSE
    v_plan_id := NULLIF(p ->> 'plan_id', '')::uuid;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan_id gerekli'; END IF;
  END IF;

  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  v_yayinda := v_plan.durum = 'yayinda';

  -- Alan değerleri (anahtar varsa yeni değer, yoksa eski)
  v_personel := CASE WHEN p ? 'personel_id' THEN NULLIF(p ->> 'personel_id', '') ELSE v_eski.personel_id END;
  v_sku      := CASE WHEN p ? 'sku'         THEN NULLIF(p ->> 'sku', '')         ELSE v_eski.sku END;
  v_plaka    := CASE WHEN p ? 'plaka_id'    THEN NULLIF(p ->> 'plaka_id', '')    ELSE v_eski.plaka_id END;
  v_ist      := CASE WHEN p ? 'istasyon'    THEN NULLIF(p ->> 'istasyon', '')    ELSE v_eski.istasyon END;
  v_miktar   := CASE WHEN p ? 'istenen_miktar' THEN NULLIF(p ->> 'istenen_miktar', '')::numeric ELSE v_eski.istenen_miktar END;
  v_not      := CASE WHEN p ? 'not_text'    THEN NULLIF(btrim(p ->> 'not_text'), '') ELSE v_eski.not_text END;
  v_talep    := CASE WHEN p ? 'talep_id'    THEN NULLIF(p ->> 'talep_id', '')::uuid ELSE v_eski.talep_id END;
  v_durum    := CASE WHEN p ? 'durum'       THEN COALESCE(NULLIF(p ->> 'durum', ''), 'aktif') ELSE COALESCE(v_eski.durum, 'aktif') END;

  IF v_personel IS NULL THEN RAISE EXCEPTION 'Personel seçilmeli'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = v_personel AND is_active = true AND role::text IN ('Üretim', 'Hat')
  ) THEN
    RAISE EXCEPTION 'Geçersiz personel: % (yalnızca aktif Üretim/Hat personeli)', v_personel;
  END IF;

  IF v_plaka IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plakalar WHERE plaka_id = v_plaka) THEN
      RAISE EXCEPTION 'Plaka bulunamadı: %', v_plaka;
    END IF;
    IF v_sku IS NULL THEN
      SELECT sku[1] INTO v_sku FROM public.plakalar
      WHERE plaka_id = v_plaka AND sku IS NOT NULL AND cardinality(sku) = 1 LIMIT 1;
    END IF;
  END IF;
  IF v_sku IS NULL AND v_plaka IS NULL THEN RAISE EXCEPTION 'Ürün veya plaka seçilmeli'; END IF;
  IF v_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', v_sku;
  END IF;
  IF v_ist IS NOT NULL AND v_ist NOT IN ('kesim', 'montaj', 'paketleme') THEN
    RAISE EXCEPTION 'Geçersiz istasyon: %', v_ist;
  END IF;
  IF v_miktar IS NOT NULL AND v_miktar <= 0 THEN RAISE EXCEPTION 'İstenen miktar sıfırdan büyük olmalı'; END IF;
  IF v_durum NOT IN ('aktif', 'pasif', 'tamamlandi') THEN RAISE EXCEPTION 'Geçersiz durum: %', v_durum; END IF;
  IF v_talep IS NOT NULL AND v_talep IS DISTINCT FROM v_eski.talep_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = v_talep AND kapanis IS NULL) THEN
      RAISE EXCEPTION 'Talep bulunamadı veya kapalı';
    END IF;
  END IF;

  IF v_durum = 'pasif' THEN
    v_pneden := CASE WHEN p ? 'pasif_neden'     THEN NULLIF(p ->> 'pasif_neden', '')          ELSE v_eski.pasif_neden END;
    v_pbas   := CASE WHEN p ? 'pasif_baslangic' THEN NULLIF(p ->> 'pasif_baslangic', '')::date ELSE COALESCE(v_eski.pasif_baslangic, public.talimat_bugun()) END;
    v_puntil := CASE WHEN p ? 'pasif_until'     THEN NULLIF(p ->> 'pasif_until', '')::date     ELSE v_eski.pasif_until END;
  END IF;

  IF v_id IS NULL THEN
    -- ── Yeni satır ──
    SELECT count(*) INTO v_n FROM public.talimat_satirlar WHERE plan_id = v_plan_id AND personel_id = v_personel;
    IF v_sira IS NOT NULL AND v_sira <= v_n AND NOT v_kaydir THEN
      RAISE EXCEPTION 'SIRA_DOLU: % numaralı öncelik dolu', v_sira;
    END IF;

    INSERT INTO public.talimat_satirlar
      (plan_id, personel_id, sira, istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id,
       durum, pasif_neden, pasif_baslangic, pasif_until, degisti)
    VALUES
      (v_plan_id, v_personel, v_n + 1, v_ist, v_sku, v_plaka, v_miktar, v_not, v_talep,
       v_durum, v_pneden, v_pbas, v_puntil, v_yayinda)
    RETURNING satir_id INTO v_id;

    IF v_sira IS NOT NULL AND v_sira <= v_n THEN
      PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
    END IF;
  ELSE
    -- ── Güncelleme ──
    v_personel_degisti := v_personel IS DISTINCT FROM v_eski.personel_id;

    v_degisti := v_yayinda AND (
      v_personel_degisti
      OR v_sku IS DISTINCT FROM v_eski.sku OR v_plaka IS DISTINCT FROM v_eski.plaka_id
      OR v_ist IS DISTINCT FROM v_eski.istasyon OR v_miktar IS DISTINCT FROM v_eski.istenen_miktar
      OR v_not IS DISTINCT FROM v_eski.not_text OR v_durum IS DISTINCT FROM v_eski.durum
      OR (v_durum = 'pasif' AND (v_pbas IS DISTINCT FROM v_eski.pasif_baslangic
                                 OR v_puntil IS DISTINCT FROM v_eski.pasif_until))
    );

    IF v_personel_degisti AND NOT (p ? 'durum') THEN
      -- Başkasına devredilen iş aktifleşir (talep durumu da yeniden aktif görünür)
      v_durum := 'aktif';
    END IF;
    IF v_durum <> 'pasif' THEN
      v_pneden := NULL; v_pbas := NULL; v_puntil := NULL;
    END IF;

    SELECT count(*) INTO v_n FROM public.talimat_satirlar WHERE plan_id = v_plan_id AND personel_id = v_personel;

    UPDATE public.talimat_satirlar SET
      personel_id = v_personel,
      sira = CASE WHEN v_personel_degisti THEN v_n + 1 ELSE sira END,
      istasyon = v_ist, sku = v_sku, plaka_id = v_plaka, istenen_miktar = v_miktar,
      not_text = v_not, talep_id = v_talep, durum = v_durum,
      pasif_neden = v_pneden, pasif_baslangic = v_pbas, pasif_until = v_puntil,
      degisti = degisti OR v_degisti
    WHERE satir_id = v_id;

    IF v_personel_degisti THEN
      PERFORM public.talimat_sira_yerlestir(v_plan_id, v_eski.personel_id);
      PERFORM public.talimat_degisen_isaretle(v_plan_id, v_eski.personel_id);
      IF v_sira IS NOT NULL THEN
        PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
      END IF;
      UPDATE public.talimat_satirlar SET degisti = degisti OR v_yayinda WHERE satir_id = v_id;
    ELSIF v_sira IS NOT NULL AND v_sira <> v_eski.sira THEN
      PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
    END IF;
  END IF;

  PERFORM public.talimat_ardisik_dogrula(v_plan_id, v_personel);
  IF v_eski.personel_id IS NOT NULL AND v_eski.personel_id <> v_personel THEN
    PERFORM public.talimat_ardisik_dogrula(v_plan_id, v_eski.personel_id);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_satir_sil(p_satir UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.talimat_satirlar%ROWTYPE;
  v_durum TEXT;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_s FROM public.talimat_satirlar WHERE satir_id = p_satir FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = v_s.plan_id;
  IF v_durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  DELETE FROM public.talimat_satirlar WHERE satir_id = p_satir;
  PERFORM public.talimat_sira_yerlestir(v_s.plan_id, v_s.personel_id);
  PERFORM public.talimat_degisen_isaretle(v_s.plan_id, v_s.personel_id);
  PERFORM public.talimat_ardisik_dogrula(v_s.plan_id, v_s.personel_id);
END;
$$;

-- Personelin satırlarını verilen sırayla yeniden numaralar (dizi = o personelin TÜM satırları)
CREATE OR REPLACE FUNCTION public.talimat_satir_sirala(p_plan UUID, p_personel TEXT, p_satir_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.talimat_planlar%ROWTYPE;
  v_n INTEGER;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  SELECT count(*) INTO v_n FROM public.talimat_satirlar WHERE plan_id = p_plan AND personel_id = p_personel;
  IF p_satir_ids IS NULL OR cardinality(p_satir_ids) <> v_n
     OR (SELECT count(DISTINCT x) FROM unnest(p_satir_ids) x) <> v_n
     OR EXISTS (
       SELECT 1 FROM unnest(p_satir_ids) x
       WHERE NOT EXISTS (SELECT 1 FROM public.talimat_satirlar s
                         WHERE s.satir_id = x AND s.plan_id = p_plan AND s.personel_id = p_personel)
     ) THEN
    RAISE EXCEPTION 'Sıralama listesi personelin tüm satırlarını içermeli';
  END IF;

  UPDATE public.talimat_satirlar s
  SET sira = o.ord::integer,
      degisti = s.degisti OR (v_plan.durum = 'yayinda' AND s.sira <> o.ord)
  FROM unnest(p_satir_ids) WITH ORDINALITY AS o(id, ord)
  WHERE s.satir_id = o.id AND s.sira <> o.ord;

  PERFORM public.talimat_ardisik_dogrula(p_plan, p_personel);
END;
$$;

-- ── Yayın / bildirim ──────────────────────────────────────────

-- Bildirimsiz (p_bildirim=false): sadece "yenile" (değişiklikler yayınlanmış sayılır, onay istenmez).
-- Bildirimli: gonderim_zamani şimdi/önceyse hemen, değilse zamanlayıcı gönderir.
-- p_hedef: 'degisenler' (varsayılan) | 'herkes'. Taslak planın ilk yayını her zaman 'herkes'.
-- Gelecek hafta planında bildirim gönderilmez (Pazartesi sabah otomatik bildirimi devreye girer).
CREATE OR REPLACE FUNCTION public.talimat_yayinla_ic(
  p_plan UUID, p_bildirim BOOLEAN, p_gonderim TIMESTAMPTZ, p_sesli BOOLEAN, p_hedef TEXT,
  p_yayinlayan TEXT, p_otomatik BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan      public.talimat_planlar%ROWTYPE;
  v_ilk       BOOLEAN;
  v_tum       BOOLEAN;
  v_hedef     TEXT;
  v_bildirim  BOOLEAN;
  v_gonderim  TIMESTAMPTZ;
  v_yayin     UUID;
  v_snapshot  JSONB;
  v_satir_n   INTEGER;
  v_personel  TEXT[];
BEGIN
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan yayınlanamaz'; END IF;

  v_ilk := v_plan.durum = 'taslak';
  v_tum := v_ilk OR p_otomatik;
  v_hedef := CASE WHEN v_tum THEN 'herkes' ELSE COALESCE(NULLIF(p_hedef, ''), 'degisenler') END;
  IF v_hedef NOT IN ('degisenler', 'herkes') THEN RAISE EXCEPTION 'Geçersiz hedef: %', v_hedef; END IF;
  v_bildirim := COALESCE(p_bildirim, false) AND v_plan.hafta_baslangic <= public.talimat_bugun();
  v_gonderim := COALESCE(p_gonderim, now());

  IF v_hedef = 'herkes' THEN
    SELECT array_agg(DISTINCT personel_id) INTO v_personel
    FROM public.talimat_satirlar WHERE plan_id = p_plan;
  ELSE
    SELECT array_agg(DISTINCT q.pid) INTO v_personel FROM (
      SELECT personel_id AS pid FROM public.talimat_satirlar WHERE plan_id = p_plan AND degisti
      UNION
      SELECT unnest(v_plan.degisen_personeller) AS pid
    ) q;
  END IF;
  IF v_personel IS NULL OR cardinality(v_personel) = 0 THEN
    RAISE EXCEPTION 'Yayınlanacak değişiklik yok';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'satir_id', satir_id, 'personel_id', personel_id, 'sira', sira, 'istasyon', istasyon,
           'sku', sku, 'plaka_id', plaka_id, 'istenen_miktar', istenen_miktar,
           'not_text', not_text, 'durum', durum) ORDER BY personel_id, sira), '[]'::jsonb),
         count(*)
    INTO v_snapshot, v_satir_n
  FROM public.talimat_satirlar
  WHERE plan_id = p_plan AND (degisti OR v_tum);

  INSERT INTO public.talimat_yayinlar
    (plan_id, yayinlayan, bildirim_gonder, sesli, hedef, gonderim_zamani, durum, otomatik,
     satir_sayisi, personel_sayisi, snapshot)
  VALUES
    (p_plan, p_yayinlayan, v_bildirim, COALESCE(p_sesli, false), v_hedef, v_gonderim,
     CASE WHEN v_bildirim THEN 'beklemede' ELSE 'bildirimsiz' END, COALESCE(p_otomatik, false),
     v_satir_n, cardinality(v_personel), v_snapshot)
  RETURNING yayin_id INTO v_yayin;

  INSERT INTO public.talimat_yayin_hedefler (yayin_id, personel_id, satir_ids)
  SELECT v_yayin, pid,
         COALESCE((SELECT array_agg(s.satir_id ORDER BY s.sira)
                   FROM public.talimat_satirlar s
                   WHERE s.plan_id = p_plan AND s.personel_id = pid AND (s.degisti OR v_tum)), '{}')
  FROM unnest(v_personel) AS pid;

  -- Kırmızı (onay bekliyor) yalnızca bildirimli ve ilk/otomatik olmayan yayında
  IF v_bildirim AND NOT v_tum THEN
    UPDATE public.talimat_satirlar SET onay_bekliyor = true WHERE plan_id = p_plan AND degisti;
  END IF;
  UPDATE public.talimat_satirlar SET degisti = false WHERE plan_id = p_plan AND degisti;

  UPDATE public.talimat_planlar SET
    durum = 'yayinda',
    yayinlandi_at = COALESCE(yayinlandi_at, now()),
    degisen_personeller = '{}',
    pazartesi_bildirim_at = CASE
      WHEN pazartesi_bildirim_at IS NULL
           AND (p_otomatik OR (v_ilk AND hafta_baslangic <= public.talimat_bugun()))
        THEN now() ELSE pazartesi_bildirim_at END
  WHERE plan_id = p_plan;

  IF v_bildirim AND v_gonderim <= now() THEN
    PERFORM public.talimat_bildirim_gonder_ic(v_yayin, false, NULL);
    UPDATE public.talimat_yayinlar SET durum = 'gonderildi', ilk_gonderim_at = now() WHERE yayin_id = v_yayin;
  END IF;

  RETURN jsonb_build_object(
    'yayin_id', v_yayin, 'personel_sayisi', cardinality(v_personel), 'satir_sayisi', v_satir_n,
    'bildirim_gonder', v_bildirim, 'ilk_yayin', v_ilk,
    'durum', (SELECT durum FROM public.talimat_yayinlar WHERE yayin_id = v_yayin));
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_yayinla(
  p_plan UUID, p_bildirim BOOLEAN DEFAULT false, p_gonderim TIMESTAMPTZ DEFAULT NULL,
  p_sesli BOOLEAN DEFAULT false, p_hedef TEXT DEFAULT 'degisenler'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  RETURN public.talimat_yayinla_ic(p_plan, p_bildirim, p_gonderim, p_sesli, p_hedef,
                                   public.talimat_kullanici_id(), false);
END;
$$;

-- Onaylamamış hedef personellere bildirim satırı yazar (tablet Realtime ile banner gösterir).
-- Aynı yayın+personel için önceki okunmamış bildirimler geri çekilmiş (geri_cekildi_at) sayılır.
CREATE OR REPLACE FUNCTION public.talimat_bildirim_gonder_ic(
  p_yayin UUID, p_hatirlatma BOOLEAN, p_personeller TEXT[] DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_y     public.talimat_yayinlar%ROWTYPE;
  r       RECORD;
  v_n     INTEGER := 0;
  v_baslik TEXT;
  v_mesaj  TEXT;
BEGIN
  SELECT * INTO v_y FROM public.talimat_yayinlar WHERE yayin_id = p_yayin;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR r IN
    SELECT h.personel_id, cardinality(h.satir_ids) AS satir_n, u.full_name, u.station::text AS istasyon
    FROM public.talimat_yayin_hedefler h
    JOIN public.users u ON u.user_id = h.personel_id
    WHERE h.yayin_id = p_yayin
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id)
      AND (p_personeller IS NULL OR h.personel_id = ANY (p_personeller))
  LOOP
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE yayin_id = p_yayin AND target_user = r.personel_id
      AND kind = 'talimat_degisiklik' AND geri_cekildi_at IS NULL;

    v_baslik := CASE
      WHEN p_hatirlatma THEN 'Hatırlatma: iş talimatını onayla'
      WHEN v_y.otomatik THEN 'Bu haftanın iş talimatı hazır'
      ELSE 'İş talimatın güncellendi' END;
    v_mesaj := CASE
      WHEN r.satir_n > 0 AND NOT v_y.otomatik THEN
        r.satir_n || ' satır değişti. Listeni kontrol edip "Görüldü, anlaşıldı" düğmesine bas.'
      ELSE 'İş talimatı listeni kontrol edip "Görüldü, anlaşıldı" düğmesine bas.' END;

    INSERT INTO public.notifications
      (notif_id, title, message, target_user, status, created_by, kind, payload, sesli, yayin_id)
    VALUES (
      'TLM-' || to_char(clock_timestamp() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDDHH24MISSMS')
        || '-' || r.personel_id || '-' || substr(md5(random()::text), 1, 4),
      v_baslik, v_mesaj, r.personel_id, 'Yeni', 'sistem', 'talimat_degisiklik',
      jsonb_build_object(
        'yayin_id', p_yayin, 'plan_id', v_y.plan_id, 'personel_id', r.personel_id,
        'personel_adi', r.full_name, 'personel_istasyon', r.istasyon,
        'satir_sayisi', r.satir_n, 'hatirlatma', p_hatirlatma, 'otomatik', v_y.otomatik),
      v_y.sesli, p_yayin);

    UPDATE public.talimat_yayin_hedefler
    SET son_bildirim_at = now(), bildirim_sayisi = bildirim_sayisi + 1
    WHERE yayin_id = p_yayin AND personel_id = r.personel_id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- onay_bekliyor bayrağını, satırı hâlâ bekleyen başka bildirimli yayın yoksa temizler
CREATE OR REPLACE FUNCTION public.talimat_onay_bekliyor_temizle(p_personel TEXT, p_satir_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.talimat_satirlar s
  SET onay_bekliyor = false
  WHERE s.satir_id = ANY (p_satir_ids)
    AND s.onay_bekliyor
    AND NOT EXISTS (
      SELECT 1
      FROM public.talimat_yayin_hedefler h
      JOIN public.talimat_yayinlar y ON y.yayin_id = h.yayin_id
      WHERE h.personel_id = p_personel
        AND s.satir_id = ANY (h.satir_ids)
        AND y.bildirim_gonder
        AND y.durum IN ('beklemede', 'gonderildi')
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id)
    );
$$;

-- Bildirimi durdurur (hatırlatmalar kesilir). p_geri_cek=true ise gönderilmiş okunmamış bildirimler
-- de geri çekilir ve onay bekleyen satır işaretleri kalkar.
CREATE OR REPLACE FUNCTION public.talimat_bildirim_durdur(p_yayin UUID, p_geri_cek BOOLEAN DEFAULT false)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_y public.talimat_yayinlar%ROWTYPE;
  r RECORD;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_y FROM public.talimat_yayinlar WHERE yayin_id = p_yayin FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Yayın bulunamadı'; END IF;
  IF v_y.durum NOT IN ('beklemede', 'gonderildi') THEN
    RAISE EXCEPTION 'Bu yayının bildirimi zaten sona ermiş (durum: %)', v_y.durum;
  END IF;

  UPDATE public.talimat_yayinlar
  SET durum = CASE WHEN p_geri_cek THEN 'geri_cekildi' ELSE 'durduruldu' END,
      durdurma_at = now(), durduran = public.talimat_kullanici_id()
  WHERE yayin_id = p_yayin;

  IF p_geri_cek THEN
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE yayin_id = p_yayin AND geri_cekildi_at IS NULL;
    FOR r IN
      SELECT h.personel_id, h.satir_ids FROM public.talimat_yayin_hedefler h
      WHERE h.yayin_id = p_yayin
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id)
    LOOP
      PERFORM public.talimat_onay_bekliyor_temizle(r.personel_id, r.satir_ids);
    END LOOP;
  END IF;
END;
$$;

-- Personel "Görüldü, anlaşıldı". p_hepsi=true: aynı plandaki onaylanmamış TÜM açık yayınları onaylar
-- (liste güncel görüldüğü için eski hatırlatmalar susar). Erişim: üretim/ofis kullanıcıları
-- (istasyon tabletinde seçili operatör p_personel olarak gönderilir).
CREATE OR REPLACE FUNCTION public.talimat_onayla(
  p_yayin UUID, p_personel TEXT, p_hepsi BOOLEAN DEFAULT true
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_ids  UUID[];
  v_y    UUID;
  v_n    INTEGER := 0;
  v_satirlar UUID[];
BEGIN
  IF NOT (public.has_production_access() OR public.is_office_user()) THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  SELECT plan_id INTO v_plan FROM public.talimat_yayinlar WHERE yayin_id = p_yayin;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Yayın bulunamadı'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_yayin_hedefler WHERE yayin_id = p_yayin AND personel_id = p_personel) THEN
    RAISE EXCEPTION 'Bu personel yayının hedefi değil';
  END IF;

  SELECT array_agg(y.yayin_id) INTO v_ids
  FROM public.talimat_yayinlar y
  JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.personel_id = p_personel
  WHERE y.plan_id = v_plan
    AND y.durum IN ('gonderildi', 'durduruldu')
    AND (p_hepsi OR y.yayin_id = p_yayin)
    AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                    WHERE o.yayin_id = y.yayin_id AND o.personel_id = p_personel);
  -- Seçilen yayın henüz 'beklemede'/'bildirimsiz' bile olsa kendisi onaylanabilir
  v_ids := COALESCE(v_ids, '{}');
  IF NOT (p_yayin = ANY (v_ids))
     AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar WHERE yayin_id = p_yayin AND personel_id = p_personel) THEN
    v_ids := array_append(v_ids, p_yayin);
  END IF;

  FOREACH v_y IN ARRAY v_ids LOOP
    INSERT INTO public.talimat_onaylar (yayin_id, personel_id, onaylayan)
    VALUES (v_y, p_personel, public.talimat_kullanici_id())
    ON CONFLICT (yayin_id, personel_id) DO NOTHING;
    v_n := v_n + 1;

    SELECT satir_ids INTO v_satirlar FROM public.talimat_yayin_hedefler
    WHERE yayin_id = v_y AND personel_id = p_personel;
    PERFORM public.talimat_onay_bekliyor_temizle(p_personel, v_satirlar);

    INSERT INTO public.notification_reads (notif_id, user_id)
    SELECT n.notif_id, p_personel FROM public.notifications n
    WHERE n.yayin_id = v_y AND n.target_user = p_personel
    ON CONFLICT (notif_id, user_id) DO NOTHING;
    UPDATE public.notifications SET status = 'Okundu'
    WHERE yayin_id = v_y AND target_user = p_personel AND status <> 'Okundu';

    -- Herkes onayladıysa yayın tamamlandı
    IF NOT EXISTS (
      SELECT 1 FROM public.talimat_yayin_hedefler h
      WHERE h.yayin_id = v_y
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id)
    ) THEN
      UPDATE public.talimat_yayinlar SET durum = 'tamamlandi'
      WHERE yayin_id = v_y AND durum IN ('gonderildi', 'beklemede');
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ── Güncellik / pasif ─────────────────────────────────────────

-- Listeyi p_gun gün "güncel" işaretler: bugün dahil p_gun gün (p_gun=1 -> bugün).
CREATE OR REPLACE FUNCTION public.talimat_guncel_isaretle(p_plan UUID, p_gun INTEGER)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bitis DATE;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF p_gun IS NULL OR p_gun < 1 OR p_gun > 31 THEN RAISE EXCEPTION 'Gün sayısı 1-31 arasında olmalı'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_planlar WHERE plan_id = p_plan) THEN
    RAISE EXCEPTION 'Plan bulunamadı';
  END IF;
  v_bitis := public.talimat_bugun() + (p_gun - 1);
  INSERT INTO public.talimat_guncellik (plan_id, bitis, isaretleyen)
  VALUES (p_plan, v_bitis, public.talimat_kullanici_id());
  RETURN v_bitis;
END;
$$;

-- Pasife alma. p_kapsam:
--   'satir'    p_ids = satir_id listesi (uuid metin)         -> satır pasif (neden + tarih aralığı)
--   'personel' p_ids = personel user_id listesi (VW...)      -> o personelin tüm listesi aralık boyunca pasif
--   'liste'    p_ids yok sayılır                              -> tüm plan aralık boyunca pasif
-- p_baslangic varsayılan bugün; p_bitis NULL = elle aktifleştirilene kadar.
-- Dönen değer: etkilenen satır/kayıt sayısı.
CREATE OR REPLACE FUNCTION public.talimat_pasif(
  p_kapsam TEXT, p_plan UUID, p_ids TEXT[], p_baslangic DATE, p_bitis DATE, p_neden TEXT
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
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  IF p_bitis IS NOT NULL AND p_bitis < v_bas THEN RAISE EXCEPTION 'Bitiş tarihi başlangıçtan önce olamaz'; END IF;

  IF p_kapsam = 'satir' THEN
    UPDATE public.talimat_satirlar
    SET durum = 'pasif', pasif_neden = NULLIF(btrim(p_neden), ''), pasif_baslangic = v_bas,
        pasif_until = p_bitis, degisti = degisti OR (v_plan.durum = 'yayinda')
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]);
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'personel' THEN
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      INSERT INTO public.talimat_pasifler (plan_id, kapsam, personel_id, baslangic, bitis, neden, olusturan)
      VALUES (p_plan, 'personel', v_p, v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
              public.talimat_kullanici_id());
      v_n := v_n + 1;
      PERFORM public.talimat_degisen_isaretle(p_plan, v_p);
    END LOOP;
  ELSIF p_kapsam = 'liste' THEN
    INSERT INTO public.talimat_pasifler (plan_id, kapsam, baslangic, bitis, neden, olusturan)
    VALUES (p_plan, 'liste', v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
            public.talimat_kullanici_id());
    v_n := 1;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

-- Pasifi kaldırır (aynı kapsam parametreleri)
CREATE OR REPLACE FUNCTION public.talimat_pasif_kaldir(p_kapsam TEXT, p_plan UUID, p_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
  v_n INTEGER := 0;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF v_yayinda IS NULL THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;

  IF p_kapsam = 'satir' THEN
    UPDATE public.talimat_satirlar
    SET durum = 'aktif', pasif_neden = NULL, pasif_baslangic = NULL, pasif_until = NULL,
        degisti = degisti OR v_yayinda
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND durum = 'pasif';
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'personel' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'personel' AND personel_id = ANY (p_ids) AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'liste' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'liste' AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

-- ── Tablet yardımcısı ─────────────────────────────────────────
-- Personelin görmesi gereken plan: bu haftanın yayındaki planı; plan pasif olduysa yalnızca
-- personelin açık montaj/paketleme seansı sürdüğü sürece (en fazla 14 gün) eski plan görünür.
-- Hiçbiri yoksa NULL (liste boş).
CREATE OR REPLACE FUNCTION public.talimat_tablet_plan(p_personel TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.plan_id
  FROM public.talimat_planlar p
  WHERE (p.durum = 'yayinda' AND p.hafta_baslangic <= public.talimat_bugun())
     OR (p.durum = 'pasif'
         AND p.hafta_baslangic >= public.talimat_bugun() - 14
         AND (EXISTS (SELECT 1 FROM public.montaj_sessions ms
                      WHERE ms.durum = 'montajda'
                        AND (ms.operator_id = p_personel OR public.talimat_workers_icerir(ms.workers, p_personel)))
              OR EXISTS (SELECT 1 FROM public.pack_events pe
                         WHERE pe.durum = 'paketlemede'
                           AND public.talimat_pack_personel_mi(pe.personel, pe.workers, p_personel))))
  ORDER BY (p.durum = 'yayinda') DESC, p.hafta_baslangic DESC
  LIMIT 1;
$$;

-- ── Yetkiler ──────────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  -- İstemciye açık RPC'ler
  FOREACH f IN ARRAY ARRAY[
    'talimat_plan_getir_veya_olustur(date)',
    'talimat_kopyala_hafta(uuid,date)',
    'talimat_satir_kaydet(jsonb)',
    'talimat_satir_sil(uuid)',
    'talimat_satir_sirala(uuid,text,uuid[])',
    'talimat_yayinla(uuid,boolean,timestamptz,boolean,text)',
    'talimat_bildirim_durdur(uuid,boolean)',
    'talimat_onayla(uuid,text,boolean)',
    'talimat_guncel_isaretle(uuid,integer)',
    'talimat_pasif(text,uuid,text[],date,date,text)',
    'talimat_pasif_kaldir(text,uuid,text[])',
    'talimat_tablet_plan(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;

  -- Yalnızca dahili çağrı (fonksiyon sahibi / pg_cron)
  FOREACH f IN ARRAY ARRAY[
    'talimat_sira_yerlestir(uuid,text,uuid,integer)',
    'talimat_degisen_isaretle(uuid,text)',
    'talimat_yayinla_ic(uuid,boolean,timestamptz,boolean,text,text,boolean)',
    'talimat_bildirim_gonder_ic(uuid,boolean,text[])',
    'talimat_onay_bekliyor_temizle(text,uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
