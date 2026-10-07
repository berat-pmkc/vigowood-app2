-- =============================================================
-- 147: Boş satır (ürünsüz personel satırı)
-- Planlayıcı önce personelleri ekler, ürünleri sonra seçer. Bu yüzden
-- satırda sku/plaka zorunluluğu kalkar. Ürünsüz ("boş") satırlar:
--   * tablette görünmez (istemci sorguları sku/plaka ister),
--   * plan özetlerinde iş sayılmaz, yayın/bildirim/snapshot'a girmez,
--   * ardışık SKU kuralında yok sayılır.
-- =============================================================

ALTER TABLE public.talimat_satirlar DROP CONSTRAINT IF EXISTS talimat_satir_urun_veya_plaka;

-- ── Ardışık SKU kuralı: ürünsüz satırlar atlanır (aralarına girse bile) ──
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
    WHERE plan_id = p_plan AND personel_id = p_personel AND sku IS NOT NULL
  ) x
  WHERE x.sku = x.onceki
  LIMIT 1;

  IF v_sku IS NOT NULL THEN
    RAISE EXCEPTION 'ARDISIK_SKU: Aynı personele art arda iki öncelikte aynı ürün verilemez (%)', v_sku
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── Plan özeti: boş satırlar iş/personel sayılmaz ──
CREATE OR REPLACE VIEW public.talimat_plan_ozet AS
SELECT
  p.plan_id, p.hafta_baslangic, p.durum, p.yayinlandi_at, p.pasif_at,
  p.pazartesi_bildirim_at, p.degisen_personeller, p.kaynak_plan_id, p.olusturan,
  p.created_at, p.updated_at,
  g.bitis AS guncel_bitis,
  COALESCE(g.bitis >= public.talimat_bugun(), false) AS guncel_mi,
  (SELECT count(*) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS satir_sayisi,
  (SELECT count(*) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND s.degisti AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS degisen_satir_sayisi,
  (SELECT count(DISTINCT s.personel_id) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS personel_sayisi
FROM public.talimat_planlar p
LEFT JOIN LATERAL (
  SELECT bitis FROM public.talimat_guncellik gg
  WHERE gg.plan_id = p.plan_id ORDER BY gg.created_at DESC, gg.id DESC LIMIT 1
) g ON true;

ALTER VIEW public.talimat_plan_ozet SET (security_invoker = true);

-- ── Satır sil: boş satır silmek yayın değişikliği sayılmaz ──
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
  IF v_s.sku IS NOT NULL OR v_s.plaka_id IS NOT NULL THEN
    PERFORM public.talimat_degisen_isaretle(v_s.plan_id, v_s.personel_id);
  END IF;
  PERFORM public.talimat_ardisik_dogrula(v_s.plan_id, v_s.personel_id);
END;
$$;

-- ── Satır kaydet (132'deki tanım; boş satıra izin verir) ──
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
  v_bos         BOOLEAN;
  v_eski_bos    BOOLEAN := true;
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
  -- Ürün/plaka zorunlu değil: ürünsüz (boş) satır geçerlidir (ürün sonra seçilir)
  IF v_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', v_sku;
  END IF;
  v_bos := v_sku IS NULL AND v_plaka IS NULL;
  IF v_id IS NOT NULL THEN v_eski_bos := v_eski.sku IS NULL AND v_eski.plaka_id IS NULL; END IF;
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
       v_durum, v_pneden, v_pbas, v_puntil, v_yayinda AND NOT v_bos)
    RETURNING satir_id INTO v_id;

    IF v_sira IS NOT NULL AND v_sira <= v_n THEN
      PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
    END IF;
  ELSE
    -- ── Güncelleme ──
    v_personel_degisti := v_personel IS DISTINCT FROM v_eski.personel_id;

    v_degisti := v_yayinda AND NOT (v_bos AND v_eski_bos) AND (
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
      IF NOT v_eski_bos THEN
        PERFORM public.talimat_degisen_isaretle(v_plan_id, v_eski.personel_id);
      END IF;
      IF v_sira IS NOT NULL THEN
        PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
      END IF;
      UPDATE public.talimat_satirlar SET degisti = degisti OR (v_yayinda AND NOT v_bos) WHERE satir_id = v_id;
    ELSIF v_sira IS NOT NULL AND v_sira <> v_eski.sira THEN
      PERFORM public.talimat_sira_yerlestir(v_plan_id, v_personel, v_id, v_sira);
    END IF;
  END IF;

  IF v_id IS NOT NULL AND v_bos AND NOT v_eski_bos THEN
    -- Dolu satırın ürünü kaldırıldı: tablette düşer, personel değişen sayılır
    PERFORM public.talimat_degisen_isaretle(v_plan_id, v_personel);
  END IF;
  PERFORM public.talimat_ardisik_dogrula(v_plan_id, v_personel);
  IF v_eski.personel_id IS NOT NULL AND v_eski.personel_id <> v_personel THEN
    PERFORM public.talimat_ardisik_dogrula(v_plan_id, v_eski.personel_id);
  END IF;

  RETURN v_id;
END;
$$;

-- ── Yayınla: boş satırlar hedef/snapshot/bildirim dışı ──
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
    FROM public.talimat_satirlar WHERE plan_id = p_plan AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
  ELSE
    SELECT array_agg(DISTINCT q.pid) INTO v_personel FROM (
      SELECT personel_id AS pid FROM public.talimat_satirlar
      WHERE plan_id = p_plan AND degisti AND (sku IS NOT NULL OR plaka_id IS NOT NULL)
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
  WHERE plan_id = p_plan AND (degisti OR v_tum) AND (sku IS NOT NULL OR plaka_id IS NOT NULL);

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
                   WHERE s.plan_id = p_plan AND s.personel_id = pid AND (s.degisti OR v_tum)
                     AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)), '{}')
  FROM unnest(v_personel) AS pid;

  -- Kırmızı (onay bekliyor) yalnızca bildirimli ve ilk/otomatik olmayan yayında
  IF v_bildirim AND NOT v_tum THEN
    UPDATE public.talimat_satirlar SET onay_bekliyor = true
    WHERE plan_id = p_plan AND degisti AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
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
